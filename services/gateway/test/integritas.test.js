import test from 'node:test';
import assert from 'node:assert/strict';
import { integritasV1 } from '../src/proofs/integritas.js';

test('Integritas v1 binds stamp and lookup to the documented hash and UID', async () => {
  const request = { id: 'trace', evidence_sha3_256: 'ab'.repeat(32), operation_id: '0xAB20' };
  const data = { status: true, uid: request.operation_id, data: '0x' + request.evidence_sha3_256 };
  let onchain = false, payload = data.data;
  const provider = integritasV1(async (path, body, trace) => {
    assert.equal(trace, request.id);
    const stamping = path === '/core/v1/timestamp/post';
    assert.equal(path, stamping ? '/core/v1/timestamp/post' : '/core/v1/timestamp/status');
    assert.deepEqual(body, stamping ? { hash: request.evidence_sha3_256.toUpperCase() } : { uids: [request.operation_id] });
    return { service: 'CORE_API', apiVersion: 1, status: 'success', statusCode: 200,
      data: stamping ? data : [{ ...data, data: payload, onchain }] };
  });
  assert.equal(await provider.submit(request), request.operation_id);
  assert.equal(await provider.poll(request), 'pending');
  onchain = true;
  assert.equal(await provider.poll(request), 'anchored');
  payload = '0x' + 'ac'.repeat(32);
  await assert.rejects(provider.poll(request), /LOOKUP_UNCERTAIN/);
});
