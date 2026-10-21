import { createTestDatabase } from './sqlite.mjs';
import { createIntegrationKey } from '../../src/lib/server/validation-api/keys.ts';
import { handleValidationApi } from '../../src/lib/server/validation-api/handler.ts';

export async function setupApi(t, { limit = 100, plan = 'pro', expires = Math.floor(Date.now() / 1000) + 86400 } = {}) {
  const { sqlite, db } = createTestDatabase(t);
  const now = Math.floor(Date.now() / 1000);
  sqlite.prepare('INSERT INTO user (id, email, created_at, plan) VALUES (?, ?, ?, ?)').run('api-user', 'api@example.test', now, plan);
  sqlite.prepare('INSERT INTO api_entitlement VALUES (?, ?, ?, ?, ?, ?)')
    .run('api-user', 'sub_api', 'price_api', now - 100, expires, limit);
  const key = await createIntegrationKey(db, 'api-user', 'LIMS');
  const logs = [];
  t.mock.method(console, 'info', (line) => logs.push(line));
  t.mock.method(console, 'error', (line) => logs.push(line));
  return {
    sqlite, db, key, logs, now,
    call: (request, operation = 'validate') => handleValidationApi(request, db, operation),
    used: () => sqlite.prepare('SELECT SUM(validations) AS used FROM api_usage').get().used ?? 0,
  };
}

export function validationRequest(key, value = { karyotype: '46,XX' }, options = {}) {
  return new Request('https://app.example.test/api/v1/validate', {
    method: 'POST', headers: { authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(value), ...options,
  });
}
