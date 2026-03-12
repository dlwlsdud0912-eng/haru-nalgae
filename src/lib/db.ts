import { Pool, neonConfig } from '@neondatabase/serverless';

neonConfig.fetchConnectionCache = true;

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL is not set');
    pool = new Pool({ connectionString });
  }
  return pool;
}

export async function query(text: string, params?: unknown[]) {
  const client = getPool();
  return client.query(text, params);
}

let dbInitialized = false;

export async function ensureDb() {
  if (dbInitialized) return;

  // users
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      created_at TEXT DEFAULT (NOW()::TEXT)
    )
  `);

  // folders
  await query(`
    CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#6EE7B7',
      icon TEXT,
      owner_id TEXT NOT NULL,
      created_at TEXT DEFAULT (NOW()::TEXT)
    )
  `);

  // folder_members
  await query(`
    CREATE TABLE IF NOT EXISTS folder_members (
      folder_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'viewer',
      created_at TEXT DEFAULT (NOW()::TEXT),
      PRIMARY KEY (folder_id, user_id)
    )
  `);

  // calendar_events
  await query(`
    CREATE TABLE IF NOT EXISTS calendar_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      folder_id TEXT,
      title TEXT NOT NULL,
      event_date TEXT NOT NULL,
      event_time TEXT,
      event_type TEXT NOT NULL DEFAULT '기타',
      memo TEXT,
      completed BOOLEAN DEFAULT FALSE,
      import_source TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_cal_events_user_id ON calendar_events(user_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_cal_events_folder_id ON calendar_events(folder_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_cal_events_event_date ON calendar_events(event_date)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_cal_events_deleted_at ON calendar_events(deleted_at)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_cal_events_import_source ON calendar_events(import_source)`);

  // event_categories
  await query(`
    CREATE TABLE IF NOT EXISTS event_categories (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      color_bg TEXT NOT NULL DEFAULT '#f3f4f6',
      color_text TEXT NOT NULL DEFAULT '#374151',
      sort_order INTEGER NOT NULL DEFAULT 0,
      keywords TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_event_categories_user_id ON event_categories(user_id)`);

  dbInitialized = true;
}
