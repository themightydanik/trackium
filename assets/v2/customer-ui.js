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
    return '<section class="panel customer-access lite-auth-screen"><div class="ops-auth-mark"><img src="assets/v2/brand/mark.png" width="52" height="44" alt=""></div><h1>' + ({
      login: 'Sign in to Trackium', register: 'Create your account', verify: 'Confirm your email',
      recover: 'Recover access', reset: 'Set a new password'
    })[screen] + '</h1>' + content[screen] +
      '<div class="form-actions">' + [
        ['login','Sign in'], ['register','Create account'], ['verify','Enter confirmation code'],
        ['recover','Forgot password'], ['reset','Enter recovery code'], ['pairing','Specialized connection']
      ].filter(([key]) => key !== screen && (!demo || key === 'pairing')).map(([key,label]) => mode(key,label)).join('') +
      '</div><p role="status" id="customer-status">' + esc(error) + '</p>' +
      (['offline','unavailable'].includes(phase) ? mode('retry','Retry connection') : '') + '</section>';
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
  root.TrackiumCustomer = { auth, company, aovxEnrollment };
})(window);
