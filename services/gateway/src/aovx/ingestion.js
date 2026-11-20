import { randomUUID } from 'node:crypto';
import { decodeAovxFrame } from './frame.js';
import { parseAovxMessage } from './messages.js';
import { adaptAovxTelemetry, AOVX_TELEMETRY_PARSER_VERSION } from './telemetry-adapter.js';

async function inTransaction(pool, work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export function createAovxIngestion(pool, { logger = console, pollMs = 5000, batchSize = 50 } = {}) {
  let timer = null;
  let running = false;
  let stopped = false;

  async function processPacket(packetId) {
    return inTransaction(pool, async client => {
      const packetResult = await client.query(
        `SELECT id,received_at,raw_payload,aovx_processing_state
         FROM gateway_packets WHERE id=$1 AND aovx_message_id=512 FOR UPDATE`,
        [packetId]
      );
      const packet = packetResult.rows[0];
      if (!packet || packet.aovx_processing_state !== 'pending') return { processed: false, reason: 'not-pending' };

      let frame, parsed;
      try {
        frame = decodeAovxFrame(packet.raw_payload);
        if (frame.messageId !== 0x0200 || !frame.checksumMatchesXor)
          throw new Error('unsupported message or XOR-candidate checksum mismatch');
        parsed = parseAovxMessage(frame);
        if (parsed.data.parsing === 'not-implemented') throw new Error('AOVX message parser unavailable');
      } catch (error) {
        await client.query(
          `UPDATE gateway_packets SET aovx_processing_state='rejected',aovx_processing_error=$2 WHERE id=$1`,
          [packet.id, String(error.message).slice(0, 500)]
        );
        return { processed: false, reason: 'rejected' };
      }

      const deviceIdBcd = frame.deviceIdBcd.toString('hex');
      if (!/^[0-9]{12}$/.test(deviceIdBcd)) {
        await client.query(
          `UPDATE gateway_packets SET aovx_processing_state='rejected',aovx_processing_error='invalid decimal BCD identifier' WHERE id=$1`,
          [packet.id]
        );
        return { processed: false, reason: 'rejected' };
      }

      const bindingResult = await client.query(
        `SELECT b.tenant_id,b.device_id,b.trust,d.enabled,d.mode,d.identity_kind
         FROM telemetry_aovx_device_bindings b
         JOIN telemetry_devices d ON d.tenant_id=b.tenant_id AND d.id=b.device_id
         WHERE b.device_id_bcd=$1 AND b.state='active' AND b.created_at <= $2
         FOR UPDATE OF b,d`,
        [deviceIdBcd, packet.received_at]
      );
      const binding = bindingResult.rows[0];
      if (!binding || !binding.enabled || binding.mode !== 'real' || binding.identity_kind !== 'physical') {
        await client.query(
          `UPDATE gateway_packets SET aovx_processing_state='unbound',
             aovx_processing_error='no eligible active tenant binding at packet receive time' WHERE id=$1`,
          [packet.id]
        );
        return { processed: false, reason: 'unbound' };
      }

      const normalized = adaptAovxTelemetry({
        frame, parsed, receivedAt: packet.received_at,
        tenantId: binding.tenant_id, deviceId: binding.device_id
      });
      const existing = await client.query(
        `SELECT id,payload FROM telemetry_events
         WHERE tenant_id=$1 AND device_id=$2 AND source='aovx-gal-v1' AND source_event_id=$3`,
        [binding.tenant_id, binding.device_id, normalized.event.source_event_id]
      );
      let eventId;
      if (existing.rowCount) {
        const previous = existing.rows[0].payload;
        if (previous.extra?.status_raw !== normalized.event.extra.status_raw ||
            previous.extra?.sequence_number !== normalized.event.extra.sequence_number ||
            previous.extra?.protocol_message_id !== 0x0200) {
          throw new Error('AOVX source event identity collision');
        }
        eventId = existing.rows[0].id;
      } else {
        const inserted = await client.query(
          `INSERT INTO telemetry_events
           (id,tenant_id,device_id,device_mode,schema_version,source,trust,source_event_id,
            occurred_at,received_at,payload,canonical_event,canonical_sha256,fixture_input_id,identity_kind,
            event_time_basis,device_time_raw,parser_version)
           VALUES($1,$2,$3,'real',1,'aovx-gal-v1','unverified',$4,
            $5,$6,$7,$8,$9,NULL,'physical','gateway_received_at',$10,$11)
           RETURNING id`,
          [randomUUID(),binding.tenant_id,binding.device_id,normalized.event.source_event_id,
            normalized.event.occurred_at,packet.received_at,normalized.event,normalized.canonical,
            normalized.sha256,normalized.deviceTimeRaw,AOVX_TELEMETRY_PARSER_VERSION]
        );
        eventId = inserted.rows[0].id;
      }
      await client.query(
        `INSERT INTO telemetry_aovx_packet_events(packet_id,tenant_id,device_id,event_id)
         VALUES($1,$2,$3,$4) ON CONFLICT(packet_id) DO NOTHING`,
        [packet.id,binding.tenant_id,binding.device_id,eventId]
      );
      await client.query(
        `UPDATE gateway_packets SET aovx_processing_state='processed',aovx_processing_error=NULL WHERE id=$1`,
        [packet.id]
      );
      return { processed: true, duplicate: existing.rowCount > 0, eventId };
    });
  }

  async function processPending() {
    if (running || stopped) return { processed: 0 };
    running = true;
    let processed = 0;
    try {
      const pending = await pool.query(
        `SELECT id FROM gateway_packets WHERE aovx_processing_state='pending'
         ORDER BY id LIMIT $1`,
        [batchSize]
      );
      for (const row of pending.rows) {
        try {
          const result = await processPacket(row.id);
          if (result.processed) processed++;
        } catch (error) {
          logger.error?.('AOVX telemetry processing deferred:', error.message);
        }
      }
      return { processed };
    } finally {
      running = false;
    }
  }

  return {
    processPacket,
    processPending,
    start() {
      if (timer || stopped) return;
      void processPending();
      timer = setInterval(() => { void processPending(); }, pollMs);
      timer.unref?.();
    },
    async stop() {
      stopped = true;
      if (timer) clearInterval(timer);
      timer = null;
      while (running) await new Promise(resolve => setTimeout(resolve, 10));
    }
  };
}
