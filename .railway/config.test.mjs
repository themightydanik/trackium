import test from 'node:test';
import assert from 'node:assert/strict';
import { createRailwayContext, project } from 'railway/iac';
import definition from './railway.ts';

test('Railway SDK evaluates an HTTP-only, single-replica, private-database test configuration', async () => {
  // Offline authoring check only; no Railway API calls, plan or deployment.
  const config = await definition(createRailwayContext({ environment: 'test' }), project);
  const gateway = config.resources.find((r) => r.name === 'Gateway');
  assert.equal(gateway.source.rootDirectory, '/');
  assert.equal(gateway.build.builder, 'DOCKERFILE');
  assert.equal(gateway.build.dockerfilePath, 'services/gateway/Dockerfile');
  assert.equal(gateway.deploy.startCommand, 'node src/server.js');
  assert.equal(gateway.deploy.healthcheckPath, '/readyz');
  assert.equal(gateway.deploy.numReplicas, 1);
  assert.equal(gateway.deploy.overlapSeconds, 0);
  assert.ok(gateway.deploy.drainingSeconds > 10);
  assert.equal(gateway.deploy.sleepApplication, false);
  assert.equal(gateway.networking?.tcpProxies, undefined);
  assert.equal(gateway.variables.DATABASE_URL.resource, 'database.Postgres');
  assert.equal(gateway.variables.DATABASE_URL.output, 'DATABASE_URL');
  assert.equal(gateway.variables.PUBLIC_ORIGIN.type, 'preserve');
  assert.equal(gateway.variables.PROOF_MODE.value, 'disabled');
  assert.equal(gateway.variables.ENABLE_TCP_RECEIVER.value, 'false');
  assert.equal(gateway.variables.ENABLE_NATIVE_CLIENTS.value, 'true');
  for (const flag of ['PROOF_ALLOW_LIVE', 'PROOF_ALLOW_MAINNET', 'ENABLE_WEB_WORKSPACE',
    'ENABLE_FIXTURE_ADAPTER', 'ENABLE_SERVER_SIMULATOR'])
    assert.equal(gateway.variables[flag].value, 'false');
});
