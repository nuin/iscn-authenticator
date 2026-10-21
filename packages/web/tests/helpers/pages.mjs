import { execFile, spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

export async function startPages(t, { seedSQL } = {}) {
  const root = resolve(import.meta.dirname, '../..');
  const workspace = await mkdtemp(join(tmpdir(), 'iscn-pages-test-'));
  const wrangler = join(root, 'node_modules/wrangler/bin/wrangler.js');
  const state = join(workspace, 'state');
  const env = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    TMPDIR: tmpdir(),
    WRANGLER_LOG_PATH: join(workspace, 'wrangler.log'),
    WRANGLER_SEND_METRICS: 'false',
    CI: 'true',
  };
  let child;
  t.after(async () => {
    if (child && child.exitCode === null) {
      const exited = once(child, 'exit');
      child.kill('SIGTERM');
      await exited;
    }
    await rm(workspace, { recursive: true, force: true });
  });
  const config = (await readFile(join(root, 'wrangler.toml'), 'utf8')).replace(
    'pages_build_output_dir = ".svelte-kit/cloudflare"',
    `pages_build_output_dir = ${JSON.stringify(join(root, '.svelte-kit/cloudflare'))}`,
  );
  await writeFile(join(workspace, 'wrangler.toml'), config);
  await run(process.execPath, [wrangler, 'd1', 'execute', 'DB', '--local',
    '--file', join(root, 'schema.sql'), '--persist-to', state], { cwd: workspace, env });
  for (const file of (await readdir(join(root, 'migrations'))).sort().filter((name) => name.endsWith('.sql'))) {
    await run(process.execPath, [wrangler, 'd1', 'execute', 'DB', '--local',
      '--file', join(root, 'migrations', file), '--persist-to', state], { cwd: workspace, env });
  }
  if (seedSQL) {
    const file = join(workspace, 'seed.sql');
    await writeFile(file, seedSQL);
    await run(process.execPath, [wrangler, 'd1', 'execute', 'DB', '--local',
      '--file', file, '--persist-to', state], { cwd: workspace, env });
  }
  child = spawn(process.execPath, [wrangler, 'pages', 'dev', '--port', '0',
    '--ip', '127.0.0.1', '--inspector-port', '0', '--persist-to', state],
  { cwd: workspace, env, stdio: ['ignore', 'pipe', 'pipe'] });
  const origin = await new Promise((resolveReady, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error(`Pages startup timed out:\n${output}`)), 30_000);
    const collect = (chunk) => {
      output += chunk;
      const match = output.match(/Ready on (http:\/\/127\.0\.0\.1:\d+)/);
      if (match) {
        clearTimeout(timer);
        resolveReady(match[1]);
      }
    };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    child.once('error', (error) => { clearTimeout(timer); reject(error); });
    child.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Pages exited (${code}):\n${output}`));
    });
  });
  return {
    origin,
    request: (path, options = {}) => fetch(new URL(path, origin), {
      ...options, redirect: 'manual', signal: AbortSignal.timeout(10_000),
    }),
  };
}
