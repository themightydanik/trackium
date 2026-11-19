import test from 'node:test';
import assert from 'node:assert/strict';
import { createAovxObservations } from '../src/aovx/observations.js';

test('AOVX observations list uses bounded stable BCD cursor pagination', async () => {
  let call;
  const service = createAovxObservations({ async query(sql, values) {
    call = { sql, values };
    return { rows: [
      { device_id_bcd: '000000000001' },
      { device_id_bcd: '000000000002' },
      { device_id_bcd: '000000000003' }
    ] };
  }});
  const firstPage = await service.list(2);
  assert.deepEqual(firstPage.devices.map(x => x.device_id_bcd), ['000000000001', '000000000002']);
  assert.equal(firstPage.next_cursor, '000000000002');
  const result = await service.list(2, '000000000001');
  assert.deepEqual(call.values, ['000000000001', 3]);
  assert.match(call.sql, /device_id_bcd > \$1/);
  assert.deepEqual(result.devices.map(x => x.device_id_bcd), ['000000000001', '000000000002']);
  assert.equal(result.next_cursor, '000000000002');
});

test('AOVX observations validate IDs and return 404 for unknown device', async () => {
  const service = createAovxObservations({ async query(_sql, values) {
    assert.equal(values[0], '221042214328');
    return { rows: [], rowCount: 0 };
  }});
  await assert.rejects(service.get('not-an-id'), { status: 400 });
  await assert.rejects(service.get('221042214328'), { status: 404 });
});

test('AOVX observations list rejects invalid page sizes', async () => {
  const service = createAovxObservations({ async query() { throw new Error('must not query'); } });
  await assert.rejects(service.list(0), { status: 400 });
  await assert.rejects(service.list(201), { status: 400 });
});

test('AOVX packet reads are bounded, newest-first and optionally device-filtered', async () => {
  let call;
  const service = createAovxObservations({ async query(sql, values) {
    call = { sql, values };
    return { rows: [
      { id: '12', raw_payload_hex: '7e', payload_bytes: 1 },
      { id: '11', raw_payload_hex: '7d', payload_bytes: 1 },
      { id: '10', raw_payload_hex: '7e', payload_bytes: 1 }
    ] };
  }});
  const page = await service.packets({ limit: 2, before: '20', deviceId: '221042214328' });
  assert.deepEqual(call.values, ['20', '221042214328', 3]);
  assert.match(call.sql, /ORDER BY id DESC LIMIT \$3/);
  assert.deepEqual(page.packets.map(x => x.id), ['12', '11']);
  assert.equal(page.next_cursor, '11');
  assert.deepEqual(await service.packets({ limit: 2 }), {
    packets: [{ id: '12', raw_payload_hex: '7e', payload_bytes: 1 }, { id: '11', raw_payload_hex: '7d', payload_bytes: 1 }],
    next_cursor: '11'
  });
});

test('AOVX packet reads reject invalid bounds and cursors', async () => {
  const service = createAovxObservations({ async query() { throw new Error('must not query'); } });
  await assert.rejects(service.packets({ limit: 0 }), { status: 400 });
  await assert.rejects(service.packets({ limit: 51 }), { status: 400 });
  await assert.rejects(service.packets({ before: '0' }), { status: 400 });
  await assert.rejects(service.packets({ before: '1;DROP TABLE gateway_packets' }), { status: 400 });
  await assert.rejects(service.packets({ deviceId: 'bad' }), { status: 400 });
});
