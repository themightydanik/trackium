(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TrackiumGateway = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  class GatewayError extends Error {
    constructor(code, message) {
      super(message);
      this.name = 'GatewayError';
      this.code = code;
    }
  }
  function validateOrigin(value) {
    let url;
    try {
      url = new URL(value);
    } catch (_) {
      throw new GatewayError('INVALID_ORIGIN', 'Enter a valid HTTPS Gateway origin.');
    }
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (
      (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (url.pathname !== '/' && url.pathname !== '')
    ) {
      throw new GatewayError(
        'INVALID_ORIGIN',
        'Use an HTTPS origin only, without credentials, paths, query parameters or fragments. HTTP is allowed only on loopback.'
      );
    }
    return url.origin;
  }
  function id(value) {
    if (
      typeof value !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    )
      throw new GatewayError('INVALID_ID', 'Invalid device identifier.');
    return encodeURIComponent(value);
  }
  class GatewayClient {
    // A future trusted, allowlisted, tenant-scoped session transport is injected here.
    // No token input, token storage, direct anonymous fetch or public proxy fallback.
    constructor(options = {}) {
      this.transport = options.transport || null;
    }
    async read(path) {
      if (!this.transport)
        throw new GatewayError('PAIRING_UNAVAILABLE', 'Ожидает реализации pairing');
      try {
        return await this.transport.read(path);
      } catch (_) {
        throw new GatewayError(
          'GATEWAY_UNAVAILABLE',
          'Gateway could not be reached. No demo data was substituted.'
        );
      }
    }
    devices(options = {}) {
      const params = new URLSearchParams({ limit: String(options.limit || 100) });
      if (options.cursor) params.set('cursor', options.cursor);
      return this.read('/v1/devices?' + params.toString());
    }
    device(deviceId) {
      return this.read('/v1/devices/' + id(deviceId));
    }
    location(deviceId) {
      return this.read('/v1/devices/' + id(deviceId) + '/location');
    }
    status(deviceId) {
      return this.read('/v1/devices/' + id(deviceId) + '/status');
    }
    history(deviceId, options = {}) {
      const params = new URLSearchParams({ limit: String(options.limit || 100) });
      ['cursor', 'from', 'to'].forEach((key) => {
        if (options[key]) params.set(key, options[key]);
      });
      return this.read('/v1/devices/' + id(deviceId) + '/events?' + params.toString());
    }
  }
  function provenance(event) {
    // Unknown/missing provenance never becomes verified, including for real registry entries.
    return event && event.trust === 'synthetic' ? 'Synthetic' : 'Unverified';
  }
  return { GatewayClient, GatewayError, validateOrigin, provenance };
});
