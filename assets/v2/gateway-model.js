(function (root, factory) {
  const model = factory();
  if (typeof module === 'object' && module.exports) module.exports = model;
  else root.TrackiumGatewayModel = model;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function numeric(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }
  // Maps actual /v1/ response envelopes. Registry mode never proves event authenticity.
  function deviceView(registry, status, location, history) {
    const event = history && Array.isArray(history.events) ? history.events[0] : null;
    const payload = (event && event.payload) || {};
    const point = location && location.location;
    const gps = (point && point.gps) || {};
    return {
      id: registry.id,
      label: registry.label,
      short: registry.id.slice(0, 8),
      mode: registry.mode,
      enabled: registry.enabled,
      status: (status && status.status) || 'unknown',
      battery: numeric(payload.battery_pct),
      temperature: numeric(payload.temperature_c),
      humidity: numeric(payload.humidity_pct),
      latitude: numeric(gps.latitude),
      longitude: numeric(gps.longitude),
      city: 'No geocoding available',
      last: (status && status.last_event_at) || null,
      shipment: null,
      trust: payload.trust === 'synthetic' ? 'synthetic' : 'unverified',
      locationTrust: point && point.trust === 'synthetic' ? 'synthetic' : 'unverified',
      events: history && Array.isArray(history.events) ? history.events : [],
      nextCursor: (history && history.next_cursor) || null
    };
  }
  async function loadDevice(client, id) {
    const responses = await Promise.all([
      client.device(id),
      client.status(id),
      client.location(id),
      client.history(id, { limit: 20 })
    ]);
    return deviceView.apply(null, responses);
  }
  return { deviceView, loadDevice };
});
