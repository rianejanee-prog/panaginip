const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const DB_DIR = process.env.RENDER_DISK_DIR || path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DB_DIR, 'database.sqlite');

let db = null;

async function initDatabase() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys = ON');

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin','custodian','technician')),
      department TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS laboratories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      building TEXT DEFAULT '',
      capacity INTEGER DEFAULT 0,
      description TEXT DEFAULT ''
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS equipment_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS equipment (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_tag TEXT UNIQUE NOT NULL,
      serial_number TEXT DEFAULT '',
      category_id INTEGER,
      brand TEXT DEFAULT '',
      model TEXT DEFAULT '',
      specifications TEXT DEFAULT '',
      laboratory_id INTEGER,
      status TEXT NOT NULL DEFAULT 'working' CHECK(status IN ('working','under_maintenance','defective','condemned')),
      date_acquired DATE,
      unit_cost REAL DEFAULT 0,
      remarks TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES equipment_categories(id),
      FOREIGN KEY (laboratory_id) REFERENCES laboratories(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_number TEXT UNIQUE NOT NULL,
      equipment_id INTEGER,
      laboratory_id INTEGER,
      reported_by INTEGER NOT NULL,
      assigned_to INTEGER,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low','medium','high','critical')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','in_progress','resolved','unrepairable')),
      resolution_notes TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved_at DATETIME,
      FOREIGN KEY (equipment_id) REFERENCES equipment(id),
      FOREIGN KEY (laboratory_id) REFERENCES laboratories(id),
      FOREIGN KEY (reported_by) REFERENCES users(id),
      FOREIGN KEY (assigned_to) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS maintenance_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      equipment_id INTEGER NOT NULL,
      ticket_id INTEGER,
      performed_by INTEGER,
      maintenance_type TEXT NOT NULL CHECK(maintenance_type IN ('repair','replacement','inspection','cleaning','software_update')),
      description TEXT NOT NULL,
      parts_replaced TEXT DEFAULT '',
      cost REAL DEFAULT 0,
      maintenance_date DATE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (equipment_id) REFERENCES equipment(id),
      FOREIGN KEY (ticket_id) REFERENCES tickets(id),
      FOREIGN KEY (performed_by) REFERENCES users(id)
    )
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_equipment_status ON equipment(status)');
  db.run('CREATE INDEX IF NOT EXISTS idx_equipment_lab ON equipment(laboratory_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status)');
  db.run('CREATE INDEX IF NOT EXISTS idx_tickets_equipment ON tickets(equipment_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_maintenance_equipment ON maintenance_logs(equipment_id)');

  saveDatabase();
  console.log('Database initialized successfully at:', DB_PATH);
  return db;
}

function saveDatabase() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

function getDb() {
  if (!db) throw new Error('Database not initialized. Call initDatabase() first.');
  return db;
}

module.exports = { initDatabase, getDb, saveDatabase, DB_PATH };

if (require.main === module) {
  initDatabase().then(() => {
    console.log('Done.');
    process.exit(0);
  });
}
