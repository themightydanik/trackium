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
