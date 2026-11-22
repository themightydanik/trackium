import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { initialize } from '../src/journal.js';
import { migrate } from '../src/telemetry/migrate.js';
import { createTelemetryService, provisionTenant } from '../src/telemetry/service.js';
import { createShipmentService } from '../src/cargo/shipments.js';
import { createIntegritas } from '../src/proofs/integritas.js';

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('TEST_DATABASE_URL required (disposable database)');

test('Integritas lost submission response survives worker restart without a second submit', async (t) => {
  const schema = 'integritas_' + randomUUID().replaceAll('-', '');
  const admin = new pg.Pool({ connectionString: url });
  const db = new pg.Pool({ connectionString: url, options: '-c search_path=' + schema });
  t.after(async () => {
    await db.end();
    await admin.query('DROP SCHEMA IF EXISTS ' + schema + ' CASCADE');
    await admin.end();
  });
  await admin.query('CREATE SCHEMA ' + schema);
  await initialize(db);
  await migrate(db);
  const { tenant_id: tenant } = await provisionTenant(db, 'Integritas test tenant');
  const device = await createTelemetryService(db).register(tenant, { label: 'Fixture', mode: 'real' });
  const shipments = createShipmentService(db);
  const shipment = await shipments.create(tenant, {
    name: 'Fixture cargo', device_id: device.id,
    route: [{ name: 'A', latitude: 51, longitude: 17 }, { name: 'B', latitude: 50, longitude: 30 }],
    conditions: { temperature_min_c: 2, temperature_max_c: 8 }
  });
  await shipments.change(tenant, shipment.id, 'active');
  const before = (await shipments.events(tenant, shipment.id, 0, 10)).events;
  let submissions = 0;
  const transport = {
    async submit() { submissions++; throw new Error('timeout after provider may have accepted'); },
    async poll() { assert.fail('no UID available to reconcile'); }
  };
  const service = createIntegritas(db, transport);
  await assert.rejects(service.prepare(tenant, before[0].id), { status: 409 });
  const [a, b] = await Promise.all([service.prepare(tenant, before[1].id), service.prepare(tenant, before[1].id)]);
  assert.deepEqual(a, b);
  await Promise.all([service.tick(), service.tick()]);
  const restarted = createIntegritas(db, transport);
  await restarted.tick();
  assert.equal(submissions, 1);
  const proof = await restarted.verify(tenant, a.id);
  assert.equal(proof.status, 'unknown');
  assert.equal(proof.error, 'SUBMISSION_UNCERTAIN');
  assert.equal(proof.operation_id, null);
  assert.equal(proof.on_chain_verified, false);
  await assert.rejects(db.query('UPDATE cargo_integritas_requests SET evidence=evidence'), /immutable/);
  assert.deepEqual((await shipments.events(tenant, shipment.id, 0, 10)).events, before);
});
