import { createClient, type Client } from '@libsql/client';

declare global {
  var __dbClient: Client | undefined;
  var __dbInitialized: boolean | undefined;
}

export function getClient(): Client {
  if (!global.__dbClient) {
    global.__dbClient = createClient({
      url: process.env.LIBSQL_URL || 'file:local.db',
      authToken: process.env.LIBSQL_AUTH_TOKEN,
    });
  }
  return global.__dbClient;
}

export async function getDb(): Promise<Client> {
  const db = getClient();
  if (!global.__dbInitialized) {
    await initSchema(db);
    global.__dbInitialized = true;
  }
  return db;
}

async function initSchema(db: Client) {
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#AEC6CF',
      department TEXT NOT NULL DEFAULT 'Gestion Clientèle',
      access_token TEXT NOT NULL UNIQUE,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS schedule_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      day_of_week INTEGER NOT NULL CHECK(day_of_week >= 0 AND day_of_week <= 6),
      start_time TEXT,
      end_time TEXT,
      start_time2 TEXT,
      end_time2 TEXT,
      UNIQUE(employee_id, day_of_week)
    );

    CREATE TABLE IF NOT EXISTS schedule_exceptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      start_time TEXT,
      end_time TEXT,
      start_time2 TEXT,
      end_time2 TEXT,
      note TEXT,
      UNIQUE(employee_id, date)
    );

    CREATE TABLE IF NOT EXISTS paid_leaves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      leave_type TEXT NOT NULL DEFAULT 'cp',
      note TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS leave_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      leave_type TEXT NOT NULL DEFAULT 'cp',
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      comment TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      rejection_reason TEXT,
      reviewed_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS timeclock (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      type TEXT NOT NULL,
      clocked_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      employee_name TEXT NOT NULL,
      message TEXT NOT NULL,
      read_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reception_planning (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      week_start TEXT NOT NULL,
      day_of_week INTEGER NOT NULL DEFAULT 0,
      slot TEXT NOT NULL,
      employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(week_start, day_of_week, slot, employee_id)
    );
  `);

  // Migrations — colonnes ajoutées progressivement
  const migrations = [
    "ALTER TABLE employees ADD COLUMN department TEXT NOT NULL DEFAULT 'Gestion Clientèle'",
    'ALTER TABLE schedule_templates ADD COLUMN start_time2 TEXT',
    'ALTER TABLE schedule_templates ADD COLUMN end_time2 TEXT',
    'ALTER TABLE schedule_exceptions ADD COLUMN start_time2 TEXT',
    'ALTER TABLE schedule_exceptions ADD COLUMN end_time2 TEXT',
    "ALTER TABLE paid_leaves ADD COLUMN leave_type TEXT NOT NULL DEFAULT 'cp'",
    "ALTER TABLE employees ADD COLUMN role TEXT NOT NULL DEFAULT 'employee'",
    "ALTER TABLE employees ADD COLUMN contract_start TEXT",
    "ALTER TABLE employees ADD COLUMN contract_end TEXT",
    "ALTER TABLE leave_requests ADD COLUMN certificate_data TEXT",
    "ALTER TABLE leave_requests ADD COLUMN certificate_name TEXT",
    "ALTER TABLE reception_planning ADD COLUMN day_of_week INTEGER NOT NULL DEFAULT 0",
  ];
  for (const sql of migrations) {
    try { await db.execute(sql); } catch { /* déjà présent */ }
  }

  await migrateReceptionPlanningConstraint(db);
}

async function migrateReceptionPlanningConstraint(db: Client) {
  try {
    const res = await db.execute(
      `SELECT sql FROM sqlite_master WHERE type='table' AND name='reception_planning'`
    );
    if (!res.rows.length) return;
    const normalizedSql = String(res.rows[0].sql || '').replace(/\s/g, '');
    if (normalizedSql.includes('UNIQUE(week_start,day_of_week')) return;

    await db.execute(`CREATE TABLE IF NOT EXISTS reception_planning_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      week_start TEXT NOT NULL,
      day_of_week INTEGER NOT NULL DEFAULT 0,
      slot TEXT NOT NULL,
      employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(week_start, day_of_week, slot, employee_id)
    )`);
    await db.execute(
      `INSERT OR IGNORE INTO reception_planning_new (id, week_start, day_of_week, slot, employee_id, created_at)
       SELECT id, week_start, COALESCE(day_of_week, 0), slot, employee_id, created_at FROM reception_planning`
    );
    await db.execute('DROP TABLE reception_planning');
    await db.execute('ALTER TABLE reception_planning_new RENAME TO reception_planning');
  } catch (e) {
    console.error('reception_planning migration error:', e);
  }
}
