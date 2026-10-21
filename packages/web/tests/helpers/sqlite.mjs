import { readFile, readdir } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';

const root = new URL('../../', import.meta.url);
const baseSchema = await readFile(new URL('schema.sql', root), 'utf8');
const migrations = await readdir(new URL('migrations/', root));
const additions = await Promise.all(migrations.sort().filter((file) => file.endsWith('.sql'))
  .map((file) => readFile(new URL(`migrations/${file}`, root), 'utf8')));

class Statement {
  constructor(sqlite, sql, gate, values = []) { Object.assign(this, { sqlite, sql, gate, values }); }
  bind(...values) { return new Statement(this.sqlite, this.sql, this.gate, values); }
  async first() {
    const result = this.sqlite.prepare(this.sql).get(...this.values) ?? null;
    await this.gate(this.sql);
    return result;
  }
  async all() { return { results: this.sqlite.prepare(this.sql).all(...this.values), success: true }; }
  async run() { return this.execute(); }
  execute() {
    const statement = this.sqlite.prepare(this.sql);
    if (statement.columns().length) return { success: true, results: statement.all(...this.values) };
    const result = statement.run(...this.values);
    return { success: true, meta: { changes: Number(result.changes) } };
  }
}

export function createTestDatabase(t, gate = async () => {}) {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  sqlite.exec([baseSchema, ...additions].join('\n'));
  const db = {
    prepare: (sql) => new Statement(sqlite, sql, gate),
    async batch(statements) {
      sqlite.exec('BEGIN IMMEDIATE');
      try {
        const results = statements.map((statement) => statement.execute());
        sqlite.exec('COMMIT');
        return results;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  };
  return { sqlite, db };
}
