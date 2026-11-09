(function () {
  'use strict';
  const modes = ['system', 'light', 'dark'];
  let mode = 'system';
  try { const saved = localStorage.getItem('trackium_v2_theme'); if (modes.includes(saved)) mode = saved; } catch (_) {}
  function apply(value) {
    mode = modes.includes(value) ? value : 'system';
    if (mode === 'system') delete document.documentElement.dataset.tcTheme;
    else document.documentElement.dataset.tcTheme = mode;
  }
  apply(mode);
  window.TrackiumAppearance = {
    get: () => mode,
    form: () => '<section class="panel server-content appearance-panel"><h2>Appearance</h2><p>Use the same Light / Dark design language as Trackium Core.</p><label class="field-label" for="appearance-theme">Theme</label><select id="appearance-theme" class="text-input">' + modes.map(m => '<option value="' + m + '" ' + (mode === m ? 'selected' : '') + '>' + m[0].toUpperCase() + m.slice(1) + '</option>').join('') + '</select></section>'
  };
  document.addEventListener('change', event => {
    if (event.target.id !== 'appearance-theme') return;
    apply(event.target.value);
    try { localStorage.setItem('trackium_v2_theme', mode); } catch (_) {}
  });
})();
