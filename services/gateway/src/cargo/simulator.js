import { randomUUID } from 'node:crypto';
import { ApiError, invalid } from '../telemetry/schema.js';
import { transaction } from './shared.js';
import { shipment, appendEvent } from './shipments.js';
import { ingestSynthetic } from './ingestion.js';
export function sample(run) {
  const route = run.snapshot.route,
    step = run.step,
    total = (route.length - 1) * 4;
  const leg = Math.min(Math.floor(step / 4), route.length - 2),
    fraction = step === total ? 1 : (step % 4) / 4;
  const a = route[leg],
    b = route[leg + 1],
    c = run.snapshot.conditions;
  const violation = run.scenario === 'temperature-excursion' && step === 2;
  return {
    schema_version: 1,
    source_event_id: run.id + ':' + step,
    occurred_at: new Date(
      new Date(run.started_at).getTime() + step * run.interval_ms
    ).toISOString(),
    gps: {
      latitude: a.latitude + (b.latitude - a.latitude) * fraction,
      longitude: a.longitude + (b.longitude - a.longitude) * fraction,
      accuracy_m: 5
    },
    temperature_c: violation
      ? c.temperature_max_c + c.tolerance_c + 3 <= 150
        ? c.temperature_max_c + c.tolerance_c + 3
        : c.temperature_min_c - c.tolerance_c - 3
      : (c.temperature_min_c + c.temperature_max_c) / 2,
    humidity_pct: 48 + (step % 3),
    battery_pct: Math.max(0, 100 - step * 0.2),
    status: violation ? 'alarm' : step === total ? 'stationary' : 'moving',
    extra: { simulation_id: run.id, step }
  };
}
export function createSimulator(pool, shipments, { enabled = false, intervalMs = 1000 } = {}) {
  function allowed() {
    if (!enabled) throw new ApiError(403, 'server simulation disabled');
  }
  return {
    async start(tenant, id, scenario) {
      allowed();
      if (!['normal', 'temperature-excursion'].includes(scenario)) invalid('invalid scenario');
      return transaction(pool, tenant, async (c) => {
        const s = await shipment(c, tenant, id, true);
        if (s.status !== 'active') throw new ApiError(409, 'simulation requires active shipment');
        if (
          scenario === 'temperature-excursion' &&
          s.conditions.temperature_max_c + s.conditions.tolerance_c + 3 > 150 &&
          s.conditions.temperature_min_c - s.conditions.tolerance_c - 3 < -100
        )
          invalid('range leaves no valid excursion sample');
        const d = (
          await c.query('SELECT * FROM telemetry_devices WHERE tenant_id=$1 AND id=$2', [
            tenant,
            s.device_id
          ])
        ).rows[0];
        if (!d.enabled || d.mode !== 'synthetic' || d.identity_kind !== 'simulator')
          throw new ApiError(403, 'dedicated simulator identity required');
        const n = (
          await c.query(
            "SELECT count(*) FROM cargo_simulations WHERE tenant_id=$1 AND state IN ('running','paused')",
            [tenant]
          )
        ).rows[0].count;
        if (Number(n) >= 5) throw new ApiError(409, 'tenant simulation limit');
        const run = (
          await c.query(
            "INSERT INTO cargo_simulations(id,tenant_id,shipment_id,device_id,state,scenario,interval_ms,snapshot) VALUES($1,$2,$3,$4,'running',$5,$6,$7) RETURNING *",
            [
              randomUUID(),
              tenant,
              id,
              s.device_id,
              scenario,
              intervalMs,
              { route: s.route, conditions: s.conditions }
            ]
          )
        ).rows[0];
        await appendEvent(
          c,
          s,
          'simulation_started',
          { simulation_id: run.id, scenario },
          'run:' + run.id
        );
        return run;
      });
    },
    async control(tenant, id, action) {
      allowed();
      const states = {
        pause: ['running', 'paused'],
        resume: ['paused', 'running'],
        finish: ['running', 'finished']
      };
      if (!states[action]) invalid('invalid simulation command');
      return transaction(pool, tenant, async (c) => {
        const r = await c.query(
          'SELECT * FROM cargo_simulations WHERE tenant_id=$1 AND id=$2 FOR UPDATE',
          [tenant, id]
        );
        const run = r.rows[0];
        if (!run) throw new ApiError(404, 'simulation not found');
        const [from, to] = states[action];
        if (run.state !== from && !(action === 'finish' && run.state === 'paused'))
          throw new ApiError(409, 'invalid simulation transition');
        if (action === 'resume') {
          const device = await c.query(
            'SELECT enabled FROM telemetry_devices WHERE tenant_id=$1 AND id=$2 FOR UPDATE',
            [tenant, run.device_id]
          );
          if (!device.rows[0]?.enabled) throw new ApiError(409, 'simulator device disabled');
        }
        await c.query(
          'UPDATE cargo_simulations SET state=$3,next_tick_at=now() WHERE tenant_id=$1 AND id=$2',
          [tenant, id, to]
        );
        const s = await shipment(c, tenant, run.shipment_id, true);
        await appendEvent(
          c,
          s,
          'simulation_' + action,
          { simulation_id: id },
          'run-control:' + randomUUID()
        );
        return { ...run, state: to };
      });
    },
    async list(tenant) {
      return {
        simulations: (
          await pool.query(
            'SELECT * FROM cargo_simulations WHERE tenant_id=$1 ORDER BY started_at DESC LIMIT 100',
            [tenant]
          )
        ).rows
      };
    },
    async tick() {
      if (!enabled) return;
      const due = (
        await pool.query(
          "SELECT id,tenant_id FROM cargo_simulations WHERE state='running' AND next_tick_at<=now() ORDER BY next_tick_at LIMIT 10"
        )
      ).rows;
      for (const candidate of due)
        await transaction(pool, candidate.tenant_id, async (c) => {
          const r = await c.query(
            "SELECT * FROM cargo_simulations WHERE tenant_id=$1 AND id=$2 AND state='running' AND next_tick_at<=now() FOR UPDATE",
            [candidate.tenant_id, candidate.id]
          );
          if (!r.rowCount) return;
          const run = r.rows[0],
            s = await shipment(c, run.tenant_id, run.shipment_id, true);
          if (s.status !== 'active') {
            await c.query("UPDATE cargo_simulations SET state='finished' WHERE id=$1", [run.id]);
            return;
          }
          const device = await c.query(
            'SELECT enabled FROM telemetry_devices WHERE tenant_id=$1 AND id=$2 FOR UPDATE',
            [run.tenant_id, run.device_id]
          );
          if (!device.rows[0]?.enabled) {
            await c.query("UPDATE cargo_simulations SET state='paused' WHERE id=$1", [run.id]);
            await appendEvent(
              c,
              s,
              'simulation_paused',
              { simulation_id: run.id, reason: 'device_disabled' },
              'disabled:' + run.id + ':' + run.step
            );
            return;
          }
          const input = sample(run);
          await ingestSynthetic(
            c,
            run.tenant_id,
            run.device_id,
            input,
            Buffer.from(JSON.stringify(input)),
            { source: 'simulator-v1', onEvent: shipments.onTelemetry }
          );
          const finished = run.step >= (run.snapshot.route.length - 1) * 4;
          await c.query(
            "UPDATE cargo_simulations SET step=step+1,state=$2,next_tick_at=now()+($3*interval '1 millisecond') WHERE id=$1",
            [run.id, finished ? 'finished' : 'running', run.interval_ms]
          );
        });
    }
  };
}
export function startWorker(simulator, logger = console) {
  let stopped = false,
    pending = Promise.resolve(),
    timer;
  const loop = () => {
    if (stopped) return;
    pending = simulator
      .tick()
      .catch((e) => logger.error('simulation tick failed', e.code ?? 'internal'))
      .finally(() => {
        if (!stopped) timer = setTimeout(loop, 1000);
      });
  };
  loop();
  return async () => {
    stopped = true;
    clearTimeout(timer);
    await pending;
  };
}
