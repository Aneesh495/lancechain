import pg from "pg";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class Database {
  private pool: pg.Pool;

  constructor(connectionString: string = "postgres://localhost:5432/lancechain_dev") {
    this.pool = new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }

  public async query<T = unknown>(text: string, params: unknown[] = []): Promise<T[]> {
    const res = await this.pool.query(text, params);
    return res.rows as T[];
  }

  public async withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  public async migrate(): Promise<void> {
    let schemaPath = path.join(__dirname, "schema.sql");
    if (!fs.existsSync(schemaPath)) {
      schemaPath = path.join(__dirname, "../../../src/db/schema.sql");
    }
    const sql = fs.readFileSync(schemaPath, "utf-8");
    await this.pool.query(sql);
  }


  public async clean(): Promise<void> {
    const tables = [
      "outbox_events",
      "projections_ratings",
      "projections_reputation",
      "projections_liabilities",
      "projections_credits",
      "projections_milestones",
      "projections_projects",
      "journal_events",
      "journal_blocks",
      "indexer_checkpoints",
    ];
    for (const table of tables) {
      await this.pool.query(`TRUNCATE TABLE ${table} CASCADE;`);
    }
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }
}
