(function () {
  'use strict';
  const $ = (id) => document.getElementById(id),
    adapter = TrackiumLocalCore.create();
  let job,
    ack,
    output,
    connected = false,
    busy = false;
  async function file(input) {
    const f = input.files[0];
    if (!f || f.size > 5000000) throw Error('Choose a JSON file of at most 5 MB');
    return JSON.parse(await f.text());
  }
  function write(value) {
    output = value;
    $('output').value = JSON.stringify(value, null, 2);
    $('download').disabled = false;
  }
  for (const name of ['job', 'ack'])
    $(name).addEventListener('change', async () => {
      try {
        const value = await file($(name));
        if (name === 'job') job = value;
        else ack = value;
        $('status').textContent = name + ' loaded; signature will be checked before use.';
      } catch (e) {
        $('status').textContent = e.message;
      }
    });
  async function run(fn) {
    if (busy) return;
    busy = true;
    for (const id of ['connect', 'inspect', 'prepare', 'publish', 'release']) $(id).disabled = true;
    try {
      if (!connected) throw Error('Connect to installed Core first');
      await fn();
    } catch (e) {
      $('status').textContent = e.message;
    } finally {
      busy = false;
      for (const id of ['connect', 'inspect', 'prepare', 'publish', 'release'])
        $(id).disabled = false;
    }
  }
  const pin = () => $('pin').value.trim().toLowerCase();
  const confirmation = () => {
    if (!$('consent').checked) throw Error('Explicit Mainnet consent required');
    return $('confirmation').value.trim();
  };
  $('connect').onclick = async () => {
    try {
      if (!connected) {
        await adapter.start();
        connected = true;
      }
      $('status').textContent =
        'MDS initialized. Use readiness check; initialization alone does not prove wallet readiness.';
    } catch (e) {
      $('status').textContent = e.message;
    }
  };
  $('inspect').onclick = () =>
    run(async () => {
      const r = await adapter.inspect(job, pin());
      $('readiness').textContent = JSON.stringify(
        {
          core: r.core,
          tenant_id: r.proof.commitment ? job.payload.bundle.records[0].tenant_id : null,
          shipment_id: r.proof.shipment_id,
          event_id: r.proof.event_id,
          source_trust: r.proof.commitment.source_trust,
          max_input: job.payload.max_input,
          txpow_id: r.state.txpow_id ?? null,
          attempts: r.state.attempts,
          locked_input_units: r.state.locked_input_units ?? null
        },
        null,
        2
      );
      $('status').textContent =
        'Job signature and immutable event chain checked. Review Mainnet consent before preparing.';
    });
  $('prepare').onclick = () =>
    run(async () => {
      write(await adapter.prepare(job, pin(), confirmation()));
      $('status').textContent =
        'Mined checkpoint persisted in Core storage; not broadcast. Import it into Gateway for signed acknowledgement.';
    });
  $('publish').onclick = () =>
    run(async () => {
      write(await adapter.publish(job, pin(), ack, confirmation()));
      $('status').textContent =
        'Result saved for authenticated Gateway import. Not independently verified here.';
    });
  $('release').onclick = () =>
    run(async () => {
      write(await adapter.release(job, pin(), ack));
      $('status').textContent =
        'Wallet slot released from a signed Gateway confirmation observation; later reorg remains possible.';
    });
  $('download').onclick = () => {
    if (!output) return;
    const url = URL.createObjectURL(
        new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' })
      ),
      link = document.createElement('a');
    link.href = url;
    link.download = 'trackium-core-exchange-' + (output.proof_id ?? 'result') + '.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
})();
