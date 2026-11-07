(function (root) {
  'use strict';
  const canonical = (v) =>
    Array.isArray(v)
      ? '[' + v.map(canonical).join(',') + ']'
      : v && typeof v === 'object'
        ? '{' +
          Object.keys(v)
            .sort()
            .map((k) => JSON.stringify(k) + ':' + canonical(v[k]))
            .join(',') +
          '}'
        : JSON.stringify(v);
  const bytes = (s) => new TextEncoder().encode(s),
    hex = (b) => Array.from(new Uint8Array(b), (n) => n.toString(16).padStart(2, '0')).join('');
  const id = (v) => {
    if (typeof v !== 'string' || !/^0x[0-9a-f]{64}$/i.test(v)) throw Error('Invalid Minima ID');
    return v.toLowerCase();
  };
  const units = (v) => {
    if (typeof v !== 'string' || !/^\d{1,20}(?:\.\d{1,44})?$/.test(v))
      throw Error('Invalid coin amount');
    const [a, b = ''] = v.split('.');
    return BigInt(a) * 10n ** 44n + BigInt(b.padEnd(44, '0'));
  };
  function minima(value) {
    const n = BigInt(value);
    return (
      (n / 10n ** 44n).toString() +
      '.' +
      (n % 10n ** 44n).toString().padStart(44, '0').replace(/0+$/, '')
    );
  }
  async function sha(s) {
    return hex(await root.crypto.subtle.digest('SHA-256', bytes(s)));
  }
  async function packet(value, pin, domain) {
    if (!root.crypto?.subtle || JSON.stringify(value).length > 5000000)
      throw Error('Secure WebCrypto and bounded packet required');
    if (!/^[a-f0-9]{64}$/.test(pin) || (await sha(canonical(value.issuer))) !== pin)
      throw Error(
        'Gateway key pin mismatch; obtain the fingerprint through the authenticated Gateway workspace'
      );
    if (value.payload?.domain !== domain) throw Error('Wrong signed packet domain');
    const key = await root.crypto.subtle.importKey(
      'jwk',
      value.issuer,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify']
    );
    const sig = Uint8Array.from(atob(value.signature), (c) => c.charCodeAt(0));
    if (
      !(await root.crypto.subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        key,
        sig,
        bytes(canonical(value.payload))
      ))
    )
      throw Error('Invalid Gateway signature');
    return value.payload;
  }
  async function jobCheck(value, pin) {
    const job = await packet(value, pin, 'trackium:local-core:job:v1'),
      p = job.bundle?.proof,
      records = job.bundle?.records;
    if (
      job.schema_version !== 1 ||
      !p ||
      job.job_id !== p.id ||
      p.publisher_kind !== 'local' ||
      p.mode !== 'live' ||
      p.chain_id !== '0x00' ||
      !Array.isArray(records) ||
      !records.length ||
      records.length > 2000 ||
      !['0.01', '0.1', '1'].includes(job.max_input) ||
      job.max_attempts !== 3
    )
      throw Error('Invalid Mainnet local job');
    id(p.publisher_address);
    let previous = null;
    for (let i = 0; i < records.length; i++) {
      const r = records[i],
        event = JSON.parse(r.canonical_payload);
      if (
        canonical(event) !== r.canonical_payload ||
        (await sha(r.canonical_payload)) !== r.sha256 ||
        Number(r.sequence) !== i + 1 ||
        event.sequence !== i + 1 ||
        r.previous_hash !== previous ||
        event.previous_hash !== previous ||
        event.event_id !== r.id ||
        event.shipment_id !== p.shipment_id ||
        r.shipment_id !== p.shipment_id ||
        event.tenant_id !== r.tenant_id ||
        r.tenant_id !== records[0].tenant_id ||
        event.source_trust !== r.source_trust ||
        r.source_trust !== p.commitment.source_trust ||
        event.event_type !== r.event_type ||
        event.schema_version !== 1
      )
        throw Error('Event hash chain mismatch');
      previous = r.sha256;
    }
    const last = records.at(-1),
      c = {
        domain: 'trackium:cargo:minima-proof:v1',
        schema_version: 1,
        publish_mode: 'live',
        chain_id: '0x00',
        publisher_address: p.publisher_address,
        event_id: last.id,
        shipment_id: p.shipment_id,
        event_type: last.event_type,
        sequence: Number(last.sequence),
        canonical_sha256: last.sha256,
        previous_hash: last.previous_hash,
        source_trust: last.source_trust
      };
    if (
      !['synthetic', 'unverified'].includes(c.source_trust) ||
      last.id !== p.event_id ||
      Number(p.sequence) !== Number(last.sequence) ||
      canonical(c) !== canonical(p.commitment)
    )
      throw Error('Commitment metadata mismatch');
    const wire =
      '0x54524b5001' + (c.source_trust === 'synthetic' ? '01' : '00') + (await sha(canonical(c)));
    if (wire !== p.wire) throw Error('Commitment wire mismatch');
    return job;
  }
  function create({ mds = root.MDS, locks = root.navigator?.locks } = {}) {
    let ready = false;
    const command = (cmd) =>
      new Promise((resolve, reject) => {
        if (!ready) return reject(Error('Installed Core MDS is not ready'));
        let done = false;
        const timer = setTimeout(
          () => {
            done = true;
            reject(Error('Core response unavailable; restore saved state before retrying'));
          },
          cmd.startsWith('txnmine ') ? 130000 : 10000
        );
        mds.cmd(cmd, (result) => {
          if (done) return;
          clearTimeout(timer);
          if (result?.pending) return resolve({ pending: result.pendinguid });
          if (result?.status !== true) {
            const e = Error('Core command failed: ' + cmd.split(' ')[0]);
            e.notFound = /^(?:Transaction not found|TxPoW not found)/i.test(result?.error ?? '');
            return reject(e);
          }
          resolve(result.response);
        });
      });
    const get = (key) =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(Error('MDS storage unavailable')), 10000);
        mds.keypair.get(key, (r) => {
          clearTimeout(timer);
          if (r?.status)
            try {
              resolve(JSON.parse(atob(r.value)));
            } catch {
              reject(Error('Invalid durable state'));
            }
          else if (r?.status === false && r.value == null) resolve(null);
          else reject(Error('MDS storage read failed'));
        });
      });
    const set = (key, value) =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(Error('MDS persistence not acknowledged')), 10000);
        mds.keypair.set(key, btoa(JSON.stringify(value)), (r) => {
          clearTimeout(timer);
          r?.status ? resolve() : reject(Error('MDS persistence failed'));
        });
      });
    const lock = (fn) => {
      if (!locks?.request)
        throw Error(
          'Web Locks required for safe multi-tab wallet exclusion; update WebView/browser'
        );
      return locks.request('trackium-core-publisher', { ifAvailable: true }, async (held) => {
        if (!held) throw Error('Another local publisher is active');
        return fn();
      });
    };
    const context = () => {
      if (
        (root.location?.pathname ?? '').startsWith('/app/') ||
        !/^0x[0-9a-f]+$/i.test(new URLSearchParams(root.location.search).get('uid') ?? '')
      )
        throw Error('Open this page inside the installed Core MiniDapp');
    };
    async function load(packetValue, pin) {
      const job = await jobCheck(packetValue, pin);
      const saved = await get('trk-proof-' + job.job_id);
      if (saved && (saved.wire !== job.bundle.proof.wire || saved.pin !== pin))
        throw Error('Saved job ownership conflict');
      if (saved) {
        if (
          !Number.isInteger(saved.attempts) ||
          saved.attempts < 0 ||
          saved.attempts > job.max_attempts
        )
          throw Error('Corrupt saved attempt budget');
        for (const key of ['signed_data', 'mined_data'])
          if (
            saved[key] &&
            (!/^0x(?:[a-f0-9]{2})+$/i.test(saved[key]) || saved[key].length > 131072)
          )
            throw Error('Corrupt saved artifact');
        if (saved.signed_data) id(saved.transaction_id);
        if (
          saved.mined_data &&
          (!saved.signed_data ||
            id(saved.txpow_id) !== saved.txpow_id ||
            (await sha(saved.mined_data)) !== saved.mined_sha256)
        )
          throw Error('Saved mined checksum or identity mismatch');
      }
      if (!Number.isFinite(Date.parse(job.expires_at))) throw Error('Invalid job expiry');
      return {
        job,
        p: job.bundle.proof,
        state: saved ?? { pin, wire: job.bundle.proof.wire, attempts: 0 }
      };
    }
    async function preflight(p) {
      const mode = await command('checkmode');
      if (!mode.writemode)
        throw Error(
          'Core WRITE permission required; grant explicitly in Minima Hub. No signing command was sent.'
        );
      const status = await command('status');
      if (
        status.version !== '1.0.49.4' ||
        !Number.isInteger(status.network?.connected) ||
        status.network.connected < 1
      )
        throw Error('Core 1.0.49.4 and connected peers required');
      const tip = await command('txpow block:' + Number(status.chain?.block));
      const age = Date.now() - Number(tip.header?.timemilli);
      if (
        tip.header?.chainid?.toLowerCase() !== '0x00' ||
        id(tip.txpowid) !== id(status.chain?.hash) ||
        !Number.isFinite(age) ||
        age < -120000 ||
        age > 600000
      )
        throw Error('Mainnet node tip is stale, inconsistent or unavailable');
      const script = await command('scripts address:' + p.publisher_address);
      if (
        script.address?.toLowerCase() !== p.publisher_address ||
        script.simple !== true ||
        !/^RETURN SIGNEDBY\(0x[a-f0-9]{64}\)$/i.test(script.script)
      )
        throw Error('Configured publisher is not this Core wallet address');
      const coins = await command(
        'coins relevant:true sendable:true checkmempool:true tokenid:0x00 address:' +
          p.publisher_address
      );
      if (!Array.isArray(coins) || coins.length > 1000) throw Error('Invalid coin response');
      let balance = 0n;
      for (const c of coins) {
        if (c.address?.toLowerCase() !== p.publisher_address || c.tokenid !== '0x00')
          throw Error('Foreign wallet coin');
        balance += units(c.amount);
      }
      if (balance < units('0.001')) throw Error('Insufficient spendable wallet balance');
      return {
        network: 'Mainnet',
        publisher_address: p.publisher_address,
        spendable_units: balance.toString(),
        spendable_minima: minima(balance),
        unit_scale: 44,
        block: status.chain.block,
        permission: 'WRITE',
        expected:
          '0.001 self-transfer; zero requested burn; temporarily locks inputs, consumes PoW/signing-key uses. Exact global synchronization is not established by a recent tip alone.'
      };
    }
    function txCheck(tx, p, maxInput, signed) {
      if (
        !Array.isArray(tx?.inputs) ||
        !tx.inputs.length ||
        tx.inputs.length > 64 ||
        !Array.isArray(tx.outputs) ||
        !tx.outputs.length ||
        tx.outputs.length > 3
      )
        throw Error('Invalid transaction');
      let input = 0n,
        output = 0n;
      for (const c of [...tx.inputs, ...tx.outputs])
        if (
          c.address?.toLowerCase() !== p.publisher_address ||
          c.tokenid !== '0x00' ||
          units(c.amount) <= 0n
        )
          throw Error('Foreign or invalid transaction coin');
      for (const c of tx.inputs) input += units(c.amount);
      for (const c of tx.outputs) output += units(c.amount);
      if (
        input !== output ||
        input > units(maxInput) ||
        input < units('0.001') ||
        !tx.outputs.some((c) => units(c.amount) === units('0.001'))
      )
        throw Error('Self-transfer input/spend limit failed');
      if (
        signed &&
        (tx.state?.length !== 1 ||
          Number(tx.state[0].port) !== 250 ||
          tx.state[0].data?.toLowerCase() !== p.wire)
      )
        throw Error('Transaction STATE differs from immutable Gateway job');
      if (
        !signed &&
        (tx.state ?? []).length &&
        !(
          tx.state.length === 1 &&
          Number(tx.state[0].port) === 250 &&
          tx.state[0].data?.toLowerCase() === p.wire
        )
      )
        throw Error('Foreign state');
    }
    const api = {
      start() {
        context();
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(Error('MDS initialization unavailable')), 10000);
          mds.init((message) => {
            if (message.event === 'inited') {
              ready = true;
              clearTimeout(timer);
              resolve();
            }
            if (message.event === 'MDS_SHUTDOWN') ready = false;
          });
        });
      },
      async inspect(value, pin) {
        return lock(async () => {
          const { job, p, state } = await load(value, pin);
          return { job_id: job.job_id, proof: p, state, core: await preflight(p) };
        });
      },
      async prepare(value, pin, confirmation) {
        return lock(async () => {
          const { job, p, state } = await load(value, pin);
          if (state.completed) throw Error('Job already completed; publication is prohibited');
          if (confirmation !== 'PUBLISH MAINNET ' + p.event_id)
            throw Error('Event-specific Mainnet approval required');
          if (new Date(job.expires_at) < new Date()) throw Error('Job approval expired');
          await preflight(p);
          const active = await get('trk-wallet-active');
          if (active && active !== job.job_id)
            throw Error(
              'Another job owns the local wallet slot; obtain Gateway confirmed release first'
            );
          await set('trk-wallet-active', job.job_id);
          const save = () => set('trk-proof-' + job.job_id, state);
          if (p.txpow_id && !state.mined_data)
            throw Error(
              'Gateway already knows a final ID; restore the existing checkpoint instead of re-mining'
            );
          if (state.mined_data)
            return {
              proof_id: job.job_id,
              txpow_id: state.txpow_id,
              transaction_id: state.transaction_id,
              mined_data: state.mined_data
            };
          const custom = 'trk_' + p.wire.slice(14);
          let row;
          try {
            row = await command('txnlist id:' + custom);
          } catch (e) {
            if (!e.notFound) throw e;
            if (state.signed_data)
              await command('txnimport id:' + custom + ' data:' + state.signed_data);
            else await command('txncreate id:' + custom);
            row = await command('txnlist id:' + custom);
          }
          if (!state.signed_data) {
            if (!row.transaction?.inputs?.length && !row.transaction?.outputs?.length) {
              await command(
                'txnaddamount id:' +
                  custom +
                  ' amount:0.001 address:' +
                  p.publisher_address +
                  ' fromaddress:' +
                  p.publisher_address +
                  ' tokenid:0x00 burn:0 storestate:true'
              );
              row = await command('txnlist id:' + custom);
            }
            txCheck(row.transaction, p, job.max_input, false);
            state.locked_input_units = row.transaction.inputs
              .reduce((n, c) => n + units(c.amount), 0n)
              .toString();
            if (!state.signing) {
              await command('txnstate id:' + custom + ' port:250 value:' + p.wire);
              await command('txnbasics id:' + custom);
              state.signing = true;
              await save();
              const signed = await command('txnsign id:' + custom + ' publickey:auto');
              if (signed.pending) {
                state.pendinguid = signed.pending;
                await save();
                throw Error(
                  'Signing is pending in Core. Approve there; Resume never blindly sends txnsign again.'
                );
              }
            }
            if (state.pendinguid) {
              if (!/^0x[a-f0-9]+$/i.test(state.pendinguid))
                throw Error('Invalid pending command ID');
              const pending = await command('checkpending uid:' + state.pendinguid);
              if (pending.pending) throw Error('Core signature still pending');
            }
            const check = await command('txncheck id:' + custom);
            if (!check.validtransaction || !check.allsignaturesvalid)
              throw Error(
                'Transaction not signed/valid; inspect Core permissions or rejected pending request'
              );
            const exported = await command('txnexport id:' + custom + ' showtxn:true');
            txCheck(exported.txn?.transaction, p, job.max_input, true);
            const witness = exported.txn?.witness;
            if (
              !witness?.signatures?.length ||
              !witness.scripts?.some(
                (s) =>
                  s.address?.toLowerCase() === p.publisher_address &&
                  /^RETURN SIGNEDBY\(0x[a-f0-9]{64}\)$/i.test(s.script)
              )
            )
              throw Error('Standard wallet signature witness required');
            if (!/^0x(?:[a-f0-9]{2})+$/i.test(exported.data) || exported.data.length > 131072)
              throw Error('Signed artifact exceeds local size limit');
            state.signed_data = exported.data;
            state.transaction_id = id(exported.txn.transaction.transactionid);
            await save();
          } else {
            txCheck(row.transaction, p, job.max_input, true);
            if (id(row.transaction.transactionid) !== state.transaction_id)
              throw Error('Recovered signed identity mismatch');
          }
          const check = await command('txncheck id:' + custom);
          if (!check.validtransaction || !check.allsignaturesvalid)
            throw Error('Recovered signatures/MMR invalid; no new transaction will be created');
          const mined = await command('txnmine id:' + custom);
          if (!/^0x(?:[a-f0-9]{2})+$/i.test(mined.data) || mined.data.length > 131072)
            throw Error('Mined artifact exceeds local size limit');
          state.txpow_id = id(mined.txpowid);
          state.mined_data = mined.data;
          state.mined_sha256 = await sha(mined.data);
          await save();
          return {
            proof_id: job.job_id,
            txpow_id: state.txpow_id,
            transaction_id: state.transaction_id,
            mined_data: state.mined_data
          };
        });
      },
      async publish(value, pin, ackValue, confirmation) {
        return lock(async () => {
          const { job, p, state } = await load(value, pin);
          if (state.completed) throw Error('Job already completed; publication is prohibited');
          if (confirmation !== 'PUBLISH MAINNET ' + p.event_id)
            throw Error('Explicit Mainnet confirmation required');
          if (!state.mined_data) throw Error('Prepare and checkpoint the mined artifact first');
          const ack = await packet(ackValue, pin, 'trackium:local-core:ack:v1');
          if (
            ack.stage !== 'checkpoint' ||
            ack.job_id !== job.job_id ||
            ack.wire !== p.wire ||
            ack.txpow_id !== state.txpow_id ||
            ack.mined_sha256 !== (await sha(state.mined_data))
          )
            throw Error('Gateway checkpoint acknowledgement mismatch');
          if ((await get('trk-wallet-active')) !== job.job_id)
            throw Error('Wallet slot ownership conflict');
          await preflight(p);
          let known = false;
          try {
            const found = await command('txpow txpowid:' + state.txpow_id);
            if (id(found.txpowid) !== state.txpow_id) throw Error('Node returned different TxPoW');
            known = true;
          } catch (e) {
            if (!e.notFound) throw e;
          }
          if (!known) {
            if (new Date(job.expires_at) < new Date())
              throw Error('Approval expired; query/export result only, no rebroadcast');
            if (state.attempts >= job.max_attempts)
              throw Error('Broadcast attempt limit exhausted');
            state.attempts++;
            await set('trk-proof-' + job.job_id, state);
            const posted = await command('txnminepost data:' + state.mined_data);
            if (id(posted?.data?.txpowid) !== state.txpow_id)
              throw Error('Post response ID mismatch; retain artifact for reconciliation');
          }
          return { proof_id: job.job_id, txpow_id: state.txpow_id };
        });
      },
      async release(value, pin, ackValue) {
        return lock(async () => {
          const { job, p, state } = await load(value, pin);
          const ack = await packet(ackValue, pin, 'trackium:local-core:ack:v1');
          if (
            ack.stage !== 'confirmed' ||
            ack.job_id !== job.job_id ||
            ack.wire !== p.wire ||
            ack.txpow_id !== state.txpow_id
          )
            throw Error('Gateway current-chain confirmation required');
          if ((await get('trk-wallet-active')) === job.job_id) await set('trk-wallet-active', null);
          state.completed = true;
          await set('trk-proof-' + job.job_id, state);
          return { released: true, txpow_id: state.txpow_id };
        });
      }
    };
    return api;
  }
  root.TrackiumLocalCore = { create, jobCheck, packet, canonical, sha, units };
})(typeof window === 'undefined' ? globalThis : window);
