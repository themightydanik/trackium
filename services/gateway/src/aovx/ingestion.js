import { randomUUID } from 'node:crypto';
import { decodeAovxFrame } from './frame.js';
import { parseAovxMessage } from './messages.js';
import { adaptAovxTelemetry, AOVX_TELEMETRY_PARSER_VERSION } from './telemetry-adapter.js';
import { tenantLock, transaction } from '../cargo/shared.js';

const bindingChanged = Symbol('AOVX binding changed during ingestion');

async function lockEligibleBinding(client, deviceIdBcd, receivedAt) {
  const { rows: [candidate] } = await client.query(
    `SELECT id,tenant_id,device_id FROM telemetry_aovx_device_bindings
     WHERE device_id_bcd=$1 AND state='active' AND created_at <= $2`,
    [deviceIdBcd, receivedAt]
  );
  if (!candidate) return null;

  // Match Cargo's tenant-first ordering before locking device or shipment rows.
  await tenantLock(client, candidate.tenant_id);
  const { rows: [device] } = await client.query(
    'SELECT enabled,mode,identity_kind FROM telemetry_devices WHERE tenant_id=$1 AND id=$2 FOR UPDATE',
    [candidate.tenant_id, candidate.device_id]
  );

  // Enrollment can change while we wait. Never switch tenants under this lock.
  const { rows: [binding] } = await client.query(
    `SELECT b.tenant_id,b.device_id,t.effective_at
     FROM telemetry_aovx_device_bindings b LEFT JOIN telemetry_aovx_transfers t ON t.destination_binding_id=b.id
     WHERE b.id=$1 AND b.tenant_id=$2 AND b.device_id=$3 AND b.state='active' FOR UPDATE OF b`,
    [candidate.id, candidate.tenant_id, candidate.device_id]
  );
  if (!binding) return bindingChanged;
  return device?.enabled && device.mode === 'real' && device.identity_kind === 'physical' ? binding : null;
}

export function createAovxIngestion(pool, { logger = console, pollMs = 5000, batchSize = 50, onEvent } = {}) {
  let timer = null;
  let running = false;
  let stopped = false;

  async function processPacket(packetId) {
    // Reacquire the binding in a new transaction and never take two tenant
    // locks in an order determined by transfer timing.
    for (let attempt = 0; attempt < 3; attempt++) {
      const result = await processAttempt(packetId);
      if (result !== bindingChanged) return result;
    }
    return { processed: false, reason: 'binding-changed' }; // Remains queued for replay.
  }

  async function processAttempt(packetId) {
    return transaction(pool, null, async client => {
      const packetResult = await client.query(
        `SELECT id,received_at,received_at::text AS receive_cutoff,raw_payload,aovx_processing_state
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

      const binding = await lockEligibleBinding(client, deviceIdBcd, packet.receive_cutoff);
      if (binding === bindingChanged) return bindingChanged;
      if (!binding) {
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
      if (binding.effective_at) {
        const event = normalized.event;
        const measurement = Date.parse(event.device_measured_at);
        // Buffered/backdated samples can contain another company's custody
        // history even when the transport delivers them after cutover.
        const withinCustody = !event.extra.buffered && Number.isFinite(measurement) &&
          measurement >= binding.effective_at.getTime() && measurement <= packet.received_at.getTime();
        const historicalRepeat = withinCustody && (await client.query(
          `SELECT 1 FROM telemetry_aovx_device_bindings b JOIN telemetry_events t
             ON t.tenant_id=b.tenant_id AND t.device_id=b.device_id
           WHERE b.device_id_bcd=$1 AND b.created_at<$2
             AND t.source='aovx-gal-v1' AND t.source_event_id=$3 AND t.received_at<$2
           LIMIT 1`, [deviceIdBcd,binding.effective_at,event.source_event_id])).rowCount > 0;
        if (!withinCustody || historicalRepeat) {
          await client.query(
            "UPDATE gateway_packets SET aovx_processing_state='rejected',aovx_processing_error='outside transfer custody window' WHERE id=$1",
            [packet.id]);
          return { processed: false, reason: 'outside-custody-window' };
        }
      }
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
      if (!existing.rowCount && onEvent)
        await onEvent(client, { id: eventId, event: normalized.event, sha256: normalized.sha256 });
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
      void processPending().catch(error => logger.error?.('AOVX telemetry worker failed:', error.message));
      timer = setInterval(() => { void processPending().catch(error => logger.error?.('AOVX telemetry worker failed:', error.message)); }, pollMs);
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
