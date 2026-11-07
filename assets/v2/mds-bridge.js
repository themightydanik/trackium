(function (root) {
  'use strict';
  // ES5 intentionally: keep runtime integration small and independent of legacy side effects.
  root.TrackiumMDS = {
    start: function (onState) {
      var uid = new URLSearchParams(root.location.search).get('uid');
      if (!uid || !/^0x[0-9a-f]+$/i.test(uid) || !root.MDS) {
        onState({ state: 'standalone', label: 'Standalone preview' });
        return;
      }
      onState({ state: 'connecting', label: 'Connecting to Minima' });
      var ready = false;
      var stopped = false;
      var heartbeat;
      var timeout;
      function checkStatus() {
        if (stopped) return;
        clearTimeout(timeout);
        timeout = setTimeout(function () {
          ready = false;
          onState({ state: 'unavailable', label: 'Minima unavailable' });
        }, 8000);
        root.MDS.cmd('status', function (result) {
          if (stopped) return;
          clearTimeout(timeout);
          if (result && result.status && result.response && result.response.chain) {
            ready = true;
            onState({
              state: 'ready',
              label: 'Minima connected',
              block: result.response.chain.block
            });
          } else {
            ready = false;
            onState({ state: 'unavailable', label: 'Minima unavailable' });
          }
        });
      }
      try {
        root.MDS.init(function (message) {
          if (message.event === 'inited') {
            // SDK emits inited locally; require an actual read-only status response.
            checkStatus();
            heartbeat = setInterval(checkStatus, 30000);
          }
          if (
            message.event === 'NEWBLOCK' &&
            ready &&
            message.data &&
            message.data.txpow &&
            message.data.txpow.header
          ) {
            onState({
              state: 'ready',
              label: 'Minima connected',
              block: message.data.txpow.header.block
            });
          }
          if (message.event === 'MDS_SHUTDOWN') {
            stopped = true;
            ready = false;
            clearInterval(heartbeat);
            clearTimeout(timeout);
            onState({ state: 'unavailable', label: 'Minima disconnected' });
          }
        });
      } catch (_) {
        clearTimeout(timeout);
        onState({ state: 'unavailable', label: 'Minima unavailable' });
      }
    },
    legacyUrl: function () {
      var uid = new URLSearchParams(root.location.search).get('uid');
      return (
        './legacy.html' +
        (uid && /^0x[0-9a-f]+$/i.test(uid) ? '?uid=' + encodeURIComponent(uid) : '')
      );
    }
  };
})(window);
