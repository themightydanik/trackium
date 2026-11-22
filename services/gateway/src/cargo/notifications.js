import { invalid, object } from '../telemetry/schema.js';
import { transaction } from './shared.js';

export function createNotifications(pool) {
  return {
    async setPreferences(tenant, input) {
      object(input, ['enabled', 'include_synthetic']);
      const { enabled, include_synthetic = false } = input;
      if (typeof enabled !== 'boolean' || typeof include_synthetic !== 'boolean' ||
          (!enabled && include_synthetic)) invalid('invalid notification preferences');

      return transaction(pool, tenant, async client => {
        await client.query(
          `INSERT INTO cargo_notification_preferences(tenant_id,enabled,include_synthetic)
           VALUES($1,$2,$3) ON CONFLICT(tenant_id) DO UPDATE SET
           enabled=EXCLUDED.enabled,include_synthetic=EXCLUDED.include_synthetic`,
          [tenant, enabled, include_synthetic]
        );
        await client.query(
          `UPDATE cargo_notification_deliveries d SET state='cancelled'
           FROM cargo_events e WHERE d.tenant_id=$1 AND e.tenant_id=d.tenant_id
           AND e.id=d.event_id AND d.state='pending' AND
           (NOT $2 OR (NOT $3 AND e.source_trust='synthetic'))`,
          [tenant, enabled, include_synthetic]
        );
        return { enabled, include_synthetic };
      });
    },
    async status(tenant) {
      const { rows: [result] } = await pool.query(
        `SELECT COALESCE((SELECT to_jsonb(p)-'tenant_id' FROM cargo_notification_preferences p
           WHERE p.tenant_id=$1), '{"enabled":false,"include_synthetic":false}'::jsonb) AS preferences,
           COALESCE((SELECT json_agg(recent ORDER BY recorded_at DESC,event_id DESC) FROM (
             SELECT d.event_id,e.shipment_id,e.event_type,e.source_trust,e.recorded_at,
                    CASE WHEN e.event_type='status_changed' THEN e.canonical_payload::jsonb->'data'->>'to' END AS shipment_status,
                    d.state,d.attempts,d.last_error,i.delivered_at
             FROM cargo_notification_deliveries d JOIN cargo_events e ON e.tenant_id=d.tenant_id AND e.id=d.event_id
             LEFT JOIN cargo_notification_inbox i ON i.tenant_id=d.tenant_id AND i.event_id=d.event_id
             WHERE d.tenant_id=$1 ORDER BY e.recorded_at DESC,d.event_id DESC LIMIT 25
           ) recent), '[]'::json) AS notifications`,
        [tenant]
      );
      return result;
    },
    async tick() {
      const { rows } = await pool.query(
        `SELECT tenant_id,event_id FROM cargo_notification_deliveries
         WHERE state='pending' AND next_attempt_at<=now() ORDER BY next_attempt_at,event_id LIMIT 20`
      );
      for (const job of rows) {
        await transaction(pool, job.tenant_id, async client => {
          const { rowCount } = await client.query(
            `SELECT 1 FROM cargo_notification_deliveries
             WHERE tenant_id=$1 AND event_id=$2 AND state='pending' AND next_attempt_at<=now()
             FOR UPDATE`, [job.tenant_id, job.event_id]
          );
          if (!rowCount) return;
          await client.query('SAVEPOINT notification_inbox');
          let error = null;
          try {
            await client.query(
              `INSERT INTO cargo_notification_inbox(tenant_id,event_id)
               VALUES($1,$2) ON CONFLICT(event_id) DO NOTHING`, [job.tenant_id, job.event_id]
            );
          } catch {
            await client.query('ROLLBACK TO SAVEPOINT notification_inbox');
            error = 'LOCAL_INBOX_WRITE_FAILED';
          }
          await client.query(
            `UPDATE cargo_notification_deliveries SET attempts=attempts+1,last_error=$3,
             state=CASE WHEN $3::text IS NULL THEN 'delivered' WHEN attempts+1>=3 THEN 'failed' ELSE 'pending' END,
             next_attempt_at=now()+((attempts+1)*interval '5 seconds')
             WHERE tenant_id=$1 AND event_id=$2`, [job.tenant_id, job.event_id, error]
          );
        });
      }
    }
  };
}

export function startNotificationWorker(notifications, logger) {
  let stopped = false, pending, timer;
  const loop = () => {
    pending = notifications.tick()
      .catch(error => logger.error('notification tick failed', error.code ?? 'internal'))
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
