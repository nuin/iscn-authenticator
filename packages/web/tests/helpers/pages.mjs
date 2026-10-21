import { execFile } from 'node:child_process';
import { startDev } from './dev-server.mjs';
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
  const cleanup = [];
  t.after(async () => {
    for (const stop of cleanup.reverse()) await stop();
    await rm(workspace, { recursive: true, force: true });
  });
  const mailerName = `iscn-mail-test-${crypto.randomUUID()}`;
  const config = (await readFile(join(root, 'wrangler.toml'), 'utf8')).replace(
    'pages_build_output_dir = ".svelte-kit/cloudflare"',
    `pages_build_output_dir = ${JSON.stringify(join(root, '.svelte-kit/cloudflare'))}`,
  );
  await writeFile(join(workspace, 'wrangler.toml'), config.replace('service = "iscn-email"', `service = "${mailerName}"`));
  await writeFile(join(workspace, '.dev.vars'), `EMAIL_AUTH_SECRET=${crypto.randomUUID()}${crypto.randomUUID()}\n`);
  const mailerConfig = join(workspace, 'mailer.json');
  await writeFile(mailerConfig, JSON.stringify({ name: mailerName, main: join(root, 'tests/helpers/capture-mailer.mjs'), compatibility_date: '2026-10-16' }));
  const mailOrigin = await startDev(process.execPath, [wrangler, 'dev', '--config', mailerConfig,
    '--port', '0', '--ip', '127.0.0.1', '--inspector-port', '0'], { cwd: workspace, env }, cleanup);
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
  const origin = await startDev(process.execPath, [wrangler, 'pages', 'dev', '--port', '0',
    '--ip', '127.0.0.1', '--inspector-port', '0', '--persist-to', state], { cwd: workspace, env }, cleanup);
  return {
    origin,
    async executeSQL(sql) {
      const file = join(workspace, 'test-update.sql');
      await writeFile(file, sql);
      await run(process.execPath, [wrangler, 'd1', 'execute', 'DB', '--local', '--file', file, '--persist-to', state], { cwd: workspace, env });
    },
    async emailCode(address) {
      const messages = await (await fetch(mailOrigin)).json();
      const message = messages.findLast((value) => value.to === address);
      if (!message) throw new Error('No email captured for test recipient');
      return message.text.match(/^\d{8}$/m)[0];
    },
    request: (path, options = {}) => fetch(new URL(path, origin), {
      ...options, redirect: 'manual', signal: AbortSignal.timeout(10_000),
    }),
  };
}
