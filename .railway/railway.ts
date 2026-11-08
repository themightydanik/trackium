import { defineRailway, postgres, preserve, project, service } from 'railway/iac';

// Dedicated test project only. Review a plan before applying; GitHub connection
// and generated HTTPS domain are configured in the UI (see deployment guide).
export default defineRailway(() => {
  const db = postgres('Postgres');
  const gateway = service('Gateway', {
    rootDirectory: '/',
    build: { builder: 'DOCKERFILE', dockerfilePath: 'services/gateway/Dockerfile' },
    start: 'node src/server.js',
    healthcheck: '/readyz',
    healthcheckTimeout: 120,
    replicas: 1,
    deploy: {
      restartPolicyType: 'ON_FAILURE',
      restartPolicyMaxRetries: 3,
      sleepApplication: false,
      overlapSeconds: 0,
      drainingSeconds: 15
    },
    env: {
      DATABASE_URL: db.env.DATABASE_URL,
      PUBLIC_ORIGIN: preserve(),
      NODE_ENV: 'production',
      DEPLOYMENT_PROFILE: 'railway-test',
      ENABLE_TCP_RECEIVER: 'false',
      ENABLE_NATIVE_CLIENTS: 'true',
      // Turn on only after the owner-pairing acceptance steps in the guide.
      ENABLE_WEB_WORKSPACE: 'false',
      ENABLE_SERVER_SIMULATOR: 'false',
      ENABLE_FIXTURE_ADAPTER: 'false',
      PROOF_MODE: 'disabled',
      PROOF_ALLOW_LIVE: 'false',
      PROOF_ALLOW_MAINNET: 'false',
      PROOF_MAX_PUBLICATIONS: '1',
      SHUTDOWN_TIMEOUT_MS: '10000'
    }
  });
  return project('Trackium Test', { resources: [db, gateway] });
});
