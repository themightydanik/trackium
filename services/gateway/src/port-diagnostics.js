import { readFile, readdir, readlink } from 'node:fs/promises';

export function parseProcNetListeners(contents, port) {
  const lines = contents.trim().split(/\r?\n/).slice(1);
  const matches = [];
  for (const line of lines) {
    const fields = line.trim().split(/\s+/);
    if (fields.length < 10 || fields[3] !== '0A') continue;
    const local = fields[1] ?? '';
    const separator = local.lastIndexOf(':');
    if (separator < 0 || Number.parseInt(local.slice(separator + 1), 16) !== port) continue;
    matches.push({ localAddressHex: local, inode: fields[9] });
  }
  return matches;
}

async function readText(path) {
  try { return await readFile(path, 'utf8'); } catch { return null; }
}

export async function diagnosePortConflict(port, { procRoot = '/proc' } = {}) {
  const [tcp, tcp6, namespace] = await Promise.all([
    readText(procRoot + '/net/tcp'),
    readText(procRoot + '/net/tcp6'),
    readlink(procRoot + '/self/ns/net').catch(() => null)
  ]);
  const listeners = [
    ...(tcp === null ? [] : parseProcNetListeners(tcp, port).map(item => ({ ...item, table: 'tcp' }))),
    ...(tcp6 === null ? [] : parseProcNetListeners(tcp6, port).map(item => ({ ...item, table: 'tcp6' })))
  ];
  const wanted = new Set(listeners.map(item => item.inode));
  const owners = [];
  if (wanted.size) {
    const entries = await readdir(procRoot, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isDirectory() || !/^[0-9]+$/.test(entry.name)) continue;
      const pid = Number(entry.name);
      const fdDir = procRoot + '/' + entry.name + '/fd';
      const fds = await readdir(fdDir).catch(() => []);
      for (const fd of fds) {
        const target = await readlink(fdDir + '/' + fd).catch(() => null);
        const inode = target?.startsWith('socket:[') && target.endsWith(']') ? target.slice(8, -1) : null;
        if (!inode || !wanted.has(inode)) continue;
        const [cmdline, comm] = await Promise.all([
          readText(procRoot + '/' + entry.name + '/cmdline'),
          readText(procRoot + '/' + entry.name + '/comm')
        ]);
        owners.push({ pid, fd, command: cmdline?.split(String.fromCharCode(0)).join(' ').trim() || comm?.trim() || null });
      }
    }
  }
  return {
    event: 'tcp_port_conflict_diagnostics',
    port,
    pid: process.pid,
    ppid: process.ppid,
    hostname: process.env.HOSTNAME || null,
    networkNamespace: namespace,
    procNetReadable: { tcp: tcp !== null, tcp6: tcp6 !== null },
    listeners,
    owners,
    ownerScan: wanted.size ? 'completed_with_permission_limits' : 'not_needed_no_listener_found'
  };
}
