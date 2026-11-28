(function (root) {
  'use strict';
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const field = (label, name, type = 'text', autocomplete = 'off') =>
    '<label class="field-label">' + label + '<input class="text-input" name="' + name + '" type="' + type +
    '" autocomplete="' + autocomplete + '" required></label>';
  const form = (action, fields, label) => '<form data-customer-form="' + action + '">' + fields +
    '<button class="button primary" type="submit">' + label + '</button></form>';
  const mode = (action, label) => '<button class="button secondary" data-customer-view="' + action + '">' + label + '</button>';
  const email = field('Work email', 'email', 'email', 'email');
  const code = field('Email code', 'code', 'text', 'one-time-code');
  const newPassword = field('New password', 'password', 'password', 'new-password');
  function auth(screen, error, phase, demo) {
    const content = {
      login: form('login', (demo ? field('Username', 'username', 'text', 'username') : email) + field('Password', 'password', 'password', 'current-password'), 'Sign in'),
      register: form('register', email, 'Send confirmation code'),
      verify: form('verify', code + newPassword, 'Confirm email'),
      recover: form('recover', email, 'Send recovery code'),
      reset: form('reset', code + newPassword, 'Reset password')
    };
    const onboarding = screen === 'register' || screen === 'verify';
    const photo = 'assets/v2/visual/' + (onboarding ? 'warehouse' : 'terminal');
    const artwork = '<div class="lite-auth-art" aria-hidden="true"><img alt="" width="960" height="720" ' +
      'fetchpriority="high" decoding="async" src="' + photo + '-480.webp" srcset="' +
      photo + '-480.webp 480w, ' + photo + '-960.webp 960w" ' +
      'sizes="(max-width: 700px) 92vw, (max-width: 1200px) 52vw, 622px"></div>';
    return '<div class="lite-auth-layout">' + artwork + '<section class="panel customer-access lite-auth-screen"><div class="ops-auth-mark"><img src="assets/v2/brand/mark.png" width="52" height="44" alt=""></div><h1>' + ({
      login: 'Sign in to Trackium', register: 'Create your account', verify: 'Confirm your email',
      recover: 'Recover access', reset: 'Set a new password'
    })[screen] + '</h1>' + content[screen] +
      '<div class="form-actions">' + [
        ['login','Sign in'], ['register','Create account'], ['verify','Enter confirmation code'],
        ['recover','Forgot password'], ['reset','Enter recovery code'], ['pairing','Specialized connection']
      ].filter(([key]) => key !== screen && (!demo || key === 'pairing')).map(([key,label]) => mode(key,label)).join('') +
      '</div><p role="status" id="customer-status">' + esc(error) + '</p>' +
      (['offline','unavailable'].includes(phase) ? mode('retry','Retry connection') : '') + '</section></div>';
  }
  const title = (role) => role.charAt(0).toUpperCase() + role.slice(1);
  const roleOptions = (role) => role.map(key => '<option value="' + key + '">' + title(key) + '</option>').join('');
  function aovxEnrollment(account) {
    if (!account.can_enroll_aovx) return '';
    return '<section class="panel customer-access"><h2>Add physical AOVX tracker</h2>' +
      '<p>Use an identifier approved for this company. Physical observations remain unverified.</p>' +
      form('aovx-enroll', field('Device label', 'label') +
        '<label class="field-label">12-digit AOVX identifier<input class="text-input" name="device_id_bcd" ' +
        'inputmode="numeric" pattern="[0-9]{12}" maxlength="12" autocomplete="off" required></label>' +
        '<label><input name="ownership" type="checkbox" value="confirmed" required> ' +
        'I confirm that this company controls the tracker and is authorized to collect its data.</label>',
        'Register and bind tracker') + '<p id="customer-status" role="status"></p></section>';
  }
  function company(account, members) {
    if (account.pilot)
      return '<section class="panel customer-access"><h2>' + esc(account.company_name) +
        '</h2><p>Owner · restricted physical pilot</p>' + mode('logout','Sign out') + '</section>';
    if (account.demo)
      return '<section class="panel customer-access"><h2>Trackium Demo</h2><p>Viewer · synthetic examples</p>' +
        mode('logout','Sign out') + '</section>';
    const manage = ['owner','admin'].includes(account.role);
    const visibleRoles = account.role === 'owner' ? ['viewer','dispatcher','admin'] : ['viewer','dispatcher'];
    const other = account.companies.filter(item => item.name && item.id !== account.tenant_id);
    return '<section class="panel customer-access"><h2>' + esc(account.company_name || 'Set up your company') + '</h2>' +
      (account.role ? '<p>' + esc(title(account.role)) + ' · ' + esc(account.email) + '</p>' : '') +
      (other.length ? form('switch', '<label class="field-label">Company<select name="company">' +
        other.map(item => '<option value="' + esc(item.id) + '">' + esc(item.name) + '</option>').join('') +
        '</select></label>', 'Switch company') : '') +
      '<div class="ops-company-actions"><section><h3>Create a company</h3>' +
      form('company', field('Company name','name'), 'Create company') + '</section><section><h3>Join a company</h3>' +
      form('accept', field('Invitation code','code','text','one-time-code'), 'Join company') + '</section></div>' +
      (manage ? form('device', field('Device label','label'), 'Add device record') + '<details class="panel ux-advanced" id="company-members"><summary>Company access</summary>' +
        form('invite', email + '<label class="field-label">Role<select name="role">' + roleOptions(visibleRoles) + '</select></label>', 'Invite colleague') +
        '<button class="button secondary" data-customer-view="members">Load members</button>' +
        (members ?? []).map(member => '<p>' + esc(member.email) + ' · ' + esc(title(member.role)) + '</p>' +
          (visibleRoles.includes(member.role) ? form('member', '<input type="hidden" name="member" value="' +
            esc(member.id) + '"><label class="field-label">New role<select name="role">' +
            roleOptions(visibleRoles) + '<option value="">Remove access</option></select></label>', 'Save member access') : '')
        ).join('') + '</details>' : '') +
      '<button class="button secondary" data-customer-view="logout">Sign out</button><p id="customer-status" role="status"></p></section>';
  }
  function deviceActivation(account) {
    if (!account.device_activation || account.role !== 'owner') return '';
    return '<section class="panel customer-access tracker-activation"><header class="visual-setup-heading">' +
      '<span class="visual-setup-icon">' + root.TrackiumMapIcons('scan-line') + '</span><div>' +
      '<h2>Activate a purchased tracker</h2><p>Use the serial number and one-time code from your activation card.</p></div></header>' +
      form('activate-device',field('Tracker name','label') +
        '<label class="field-label">Tracker serial number<input class="text-input" name="serial" maxlength="64" autocomplete="off" required></label>' +
        '<label class="field-label">Activation code<input type="password" class="text-input" name="code" maxlength="43" autocomplete="off" required></label>',
        'Activate tracker') + '<p id="activation-status" role="status"></p></section>';
  }
  function renameDevice(device) {
    return '<section class="panel customer-access"><h3>Rename device</h3>' +
      form('rename-device','<input type="hidden" name="device_id" value="' + esc(device.id) + '">' +
        '<label class="field-label">New device name<input class="text-input" name="label" maxlength="120" required value="' +
        esc(device.label) + '"></label>', 'Save device name') + '<p id="device-rename-status" role="status"></p></section>';
  }
  function applications(account) {
    const section = (type, label, help) => {
      const release = account.android_downloads?.[type];
      let link = '';
      if (release?.url && release.version) {
        const url = new URL(release.url);
        if (url.protocol === 'https:' && url.hostname === 'github.com')
          link = '<p><a class="button secondary" href="' + esc(url.href) + '" target="_blank" rel="noopener noreferrer">' +
            'Download ' + label + ' APK · ' + esc(release.version) + '</a></p>';
      }
      return '<section><h3>' + label + '</h3>' + (link || '<p>No signed download published yet.</p>') +
        '<p>' + help + '</p></section>';
    };
    return '<section class="panel customer-access"><h2>My Applications</h2><div class="ops-company-actions">' +
      '<section><h3>Trackium Lite Web</h3><p><a class="button secondary" href="#map">Open Fleet Map</a></p></section>' +
      section('lite','Trackium Lite Android','Install the signed APK and sign in with your existing Trackium account.') +
      section('core','Trackium Core Android','Install Core, unlock it locally, then open Devices to scan a connection QR or activation card.') +
      '</div></section>';
  }

  function coreConnections(device) {
    const id = '<input type="hidden" name="device_id" value="' + esc(device.id) + '">';
    return '<section class="panel customer-access" id="core-connections"><h3>Connect to Trackium Core</h3>' +
      '<p>Choose access for this installation. View Only allows reading this tracker’s observations.</p>' +
      form('core-device-issue',id + '<label class="field-label">Permission<select name="permission">' +
        '<option value="view">View Only</option><option value="full">Full Access</option></select></label>', 'Generate connection QR') +
      '<div id="core-connection-code"></div>' +
      form('core-device-list',id,'Refresh connected installations') +
      '<div id="core-installations"></div><p id="core-connection-status" role="status"></p></section>';
  }

  function coreInstallationRows(deviceId, installations) {
    return installations.map(item => {
      const pending = !item.approved_at;
      const hidden = '<input type="hidden" name="device_id" value="' + esc(deviceId) +
        '"><input type="hidden" name="installation_id" value="' + esc(item.id) + '">';
      return '<div><p>' + (item.permission === 'full' ? 'Full Access' : 'View Only') +
        ' · ' + (pending ? 'Awaiting confirmation' : 'Connected') + '</p><code style="overflow-wrap:anywhere">' +
        esc(item.fingerprint) + '</code>' + (pending ? form('core-device-approve',hidden,'Approve matched fingerprint') : '') +
        form('core-device-revoke',hidden,'Revoke installation') + '</div>';
    }).join('') || '<p>No installations connected.</p>';
  }
  root.TrackiumCustomer = { auth, company, aovxEnrollment, deviceActivation, renameDevice, coreConnections, coreInstallationRows, applications };
})(window);
