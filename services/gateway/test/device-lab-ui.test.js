import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const workspaceSource = await readFile(
  new URL('../../../assets/v2/workspace-ui.js', import.meta.url), 'utf8'
);
const appSource = await readFile(
  new URL('../../../assets/v2/cargo.js', import.meta.url), 'utf8'
);

test('physical device lab scripts parse and expose read-only controls', () => {
  new vm.Script(workspaceSource, { filename: 'workspace-ui.js' });
  new vm.Script(appSource, { filename: 'cargo.js' });
  for (const action of [
    'load-device-diagnostics',
    'start-device-diagnostics',
    'stop-device-diagnostics',
    'export-device-diagnostics'
  ]) {
    assert.match(workspaceSource, new RegExp(action));
    assert.match(appSource, new RegExp(action));
  }
  assert.match(appSource, /setTimeout\(\(\) => readDeviceLab\(deviceId, history, run, true\), 10000\)/);
  assert.match(appSource, /clearTimeout\(deviceLabTimer\)/);
  assert.match(appSource, /server\.state\.history !== history/);
  assert.match(appSource, /server\.request\('\/v1\/devices\/'.*\/diagnostics'\)/);
  assert.match(appSource, /contains_location_data: true/);
  assert.match(appSource, /scope: 'Last loaded history page only/);
});
