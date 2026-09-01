const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const IS_VERCEL = !!process.env.VERCEL;
const DB_DIR = IS_VERCEL ? null : (process.env.RENDER_DISK_DIR || path.join(__dirname, '..', 'data'));
const DB_PATH = DB_DIR ? path.join(DB_DIR, 'database.sqlite') : null;

let db = null;
let seeded = false;

async function initDatabase() {
  const SQL = await initSqlJs();

  if (!IS_VERCEL && DB_PATH) {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(DB_PATH)) {
      const buffer = fs.readFileSync(DB_PATH);
      db = new SQL.Database(buffer);
      const count = db.exec("SELECT COUNT(*) as c FROM users");
      if (count.length > 0 && count[0].values[0][0] > 0) {
        seeded = true;
      }
    } else {
      db = new SQL.Database();
    }
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys = ON');

  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT, full_name TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','custodian','technician')),
    department TEXT DEFAULT '', created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS laboratories (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE,
    building TEXT DEFAULT '', capacity INTEGER DEFAULT 0, description TEXT DEFAULT ''
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS equipment_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS equipment (
    id INTEGER PRIMARY KEY AUTOINCREMENT, asset_tag TEXT UNIQUE NOT NULL, serial_number TEXT DEFAULT '',
    category_id INTEGER, brand TEXT DEFAULT '', model TEXT DEFAULT '', specifications TEXT DEFAULT '',
    laboratory_id INTEGER, status TEXT NOT NULL DEFAULT 'working' CHECK(status IN ('working','under_maintenance','defective','condemned')),
    date_acquired DATE, unit_cost REAL DEFAULT 0, remarks TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES equipment_categories(id), FOREIGN KEY (laboratory_id) REFERENCES laboratories(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT, ticket_number TEXT UNIQUE NOT NULL,
    equipment_id INTEGER, laboratory_id INTEGER, reported_by INTEGER NOT NULL, assigned_to INTEGER,
    title TEXT NOT NULL, description TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low','medium','high','critical')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','in_progress','resolved','unrepairable')),
    resolution_notes TEXT DEFAULT '', created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, resolved_at DATETIME,
    FOREIGN KEY (equipment_id) REFERENCES equipment(id), FOREIGN KEY (laboratory_id) REFERENCES laboratories(id),
    FOREIGN KEY (reported_by) REFERENCES users(id), FOREIGN KEY (assigned_to) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS maintenance_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT, equipment_id INTEGER NOT NULL, ticket_id INTEGER,
    performed_by INTEGER, maintenance_type TEXT NOT NULL CHECK(maintenance_type IN ('repair','replacement','inspection','cleaning','software_update')),
    description TEXT NOT NULL, parts_replaced TEXT DEFAULT '', cost REAL DEFAULT 0,
    maintenance_date DATE NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (equipment_id) REFERENCES equipment(id), FOREIGN KEY (ticket_id) REFERENCES tickets(id),
    FOREIGN KEY (performed_by) REFERENCES users(id)
  )`);

  db.run('CREATE INDEX IF NOT EXISTS idx_equipment_status ON equipment(status)');
  db.run('CREATE INDEX IF NOT EXISTS idx_equipment_lab ON equipment(laboratory_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status)');
  db.run('CREATE INDEX IF NOT EXISTS idx_tickets_equipment ON tickets(equipment_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_maintenance_equipment ON maintenance_logs(equipment_id)');

  if (!seeded) {
    await seedData();
    seeded = true;
  }

  saveDatabase();
  return db;
}

async function seedData() {
  const bcrypt = require('bcryptjs');
  const hash = (pwd) => bcrypt.hashSync(pwd, 10);

  db.prepare('INSERT INTO users (full_name, email, password, role, department) VALUES (?, ?, ?, ?, ?)').run('System Administrator', 'admin@chs.edu.ph', hash('admin123'), 'admin', 'IT Department');
  db.prepare('INSERT INTO users (full_name, email, password, role, department) VALUES (?, ?, ?, ?, ?)').run('Juan Dela Cruz', 'custodian@chs.edu.ph', hash('custodian123'), 'custodian', 'Computer Laboratory');
  db.prepare('INSERT INTO users (full_name, email, password, role, department) VALUES (?, ?, ?, ?, ?)').run('Maria Santos', 'tech@chs.edu.ph', hash('tech123'), 'technician', 'Maintenance Department');
  db.prepare('INSERT INTO users (full_name, email, password, role, department) VALUES (?, ?, ?, ?, ?)').run('Pedro Reyes', 'custodian2@chs.edu.ph', hash('custodian123'), 'custodian', 'Computer Laboratory');
  db.prepare('INSERT INTO users (full_name, email, password, role, department) VALUES (?, ?, ?, ?, ?)').run('Ana Garcia', 'tech2@chs.edu.ph', hash('tech123'), 'technician', 'Maintenance Department');

  db.prepare('INSERT INTO laboratories (name, building, capacity, description) VALUES (?, ?, ?, ?)').run('Computer Lab 1', 'Main Building', 40, 'Main computer laboratory with desktop units');
  db.prepare('INSERT INTO laboratories (name, building, capacity, description) VALUES (?, ?, ?, ?)').run('Computer Lab 2', 'Main Building', 40, 'Secondary computer laboratory');
  db.prepare('INSERT INTO laboratories (name, building, capacity, description) VALUES (?, ?, ?, ?)').run('Computer Lab 3', 'Annex Building', 30, 'IT specialized laboratory');
  db.prepare('INSERT INTO laboratories (name, building, capacity, description) VALUES (?, ?, ?, ?)').run('Library Computer Area', 'Library Building', 20, 'Open-access computers for research');

  ['Desktop Computer','Monitor','Keyboard','Mouse','Router/Switch','UPS','Printer','Furniture'].forEach(c => {
    db.prepare('INSERT INTO equipment_categories (name) VALUES (?)').run(c);
  });

  const brands = ['Dell','HP','Lenovo','Acer'];
  const models = ['OptiPlex 3080','ProDesk 400','ThinkCentre M70s','Veriton X2640'];
  const statuses = ['working','working','working','working','under_maintenance','defective'];
  let tag = 1;
  for (let lab = 1; lab <= 4; lab++) {
    const count = lab === 4 ? 20 : 30;
    for (let i = 0; i < count; i++) {
      const m = String(Math.floor(Math.random()*12)+1).padStart(2,'0');
      const d = String(Math.floor(Math.random()*28)+1).padStart(2,'0');
      db.prepare('INSERT INTO equipment (asset_tag, serial_number, category_id, brand, model, specifications, laboratory_id, status, date_acquired, unit_cost) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
        `CHS-LAB${lab}-${String(tag).padStart(4,'0')}`, `SN-${tag}`, 1,
        brands[Math.floor(Math.random()*4)], models[Math.floor(Math.random()*4)],
        `Intel Core i${Math.floor(Math.random()*3)+5}, ${Math.floor(Math.random()*3+8)}GB RAM, ${Math.floor(Math.random()*3+128)}GB SSD`,
        lab, statuses[Math.floor(Math.random()*6)], `2024-${m}-${d}`,
        Math.floor(Math.random()*20000+25000)
      );
      tag++;
    }
  }

  db.prepare("INSERT INTO tickets (ticket_number, equipment_id, laboratory_id, reported_by, assigned_to, title, description, priority, status, resolution_notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run('TKT-2026-0001', 1, 1, 2, 3, 'Blue Screen Error', 'Computer displays BSOD with MEMORY_MANAGEMENT error', 'high', 'resolved', 'Replaced faulty RAM module');
  db.prepare("INSERT INTO tickets (ticket_number, equipment_id, laboratory_id, reported_by, assigned_to, title, description, priority, status, resolution_notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run('TKT-2026-0002', 5, 1, 2, 3, 'No Display Output', 'Monitor shows no signal even when PC is on', 'medium', 'in_progress', '');
  db.prepare("INSERT INTO tickets (ticket_number, equipment_id, laboratory_id, reported_by, assigned_to, title, description, priority, status, resolution_notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run('TKT-2026-0003', 12, 2, 4, 5, 'Keyboard Not Responding', 'Some keys not functioning', 'low', 'pending', '');
  db.prepare("INSERT INTO tickets (ticket_number, equipment_id, laboratory_id, reported_by, assigned_to, title, description, priority, status, resolution_notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run('TKT-2026-0004', 25, 3, 2, 3, 'Network Connectivity Issue', 'Cannot connect to internet in Lab 3', 'critical', 'pending', '');
  db.prepare("INSERT INTO tickets (ticket_number, equipment_id, laboratory_id, reported_by, assigned_to, title, description, priority, status, resolution_notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run('TKT-2026-0005', 33, 4, 4, 5, 'System Running Slow', 'Computer takes too long to boot', 'medium', 'resolved', 'Cleaned dust, reinstalled OS');

  db.prepare('INSERT INTO maintenance_logs (equipment_id, ticket_id, performed_by, maintenance_type, description, parts_replaced, cost, maintenance_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(1, 1, 3, 'repair', 'Replaced faulty 8GB DDR4 RAM module', '8GB DDR4 RAM', 2500, '2026-01-15');
  db.prepare('INSERT INTO maintenance_logs (equipment_id, ticket_id, performed_by, maintenance_type, description, parts_replaced, cost, maintenance_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(5, 2, 3, 'inspection', 'Inspected display cable and graphics card', '', 0, '2026-02-01');
  db.prepare('INSERT INTO maintenance_logs (equipment_id, ticket_id, performed_by, maintenance_type, description, parts_replaced, cost, maintenance_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(33, 5, 5, 'repair', 'Full system cleaning, thermal paste replacement', 'Thermal paste', 500, '2026-01-20');

  console.log('Database seeded successfully!');
}

function saveDatabase() {
  if (!db || IS_VERCEL) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  } catch (e) { console.error('Save error:', e); }
}

function getDb() {
  if (!db) throw new Error('Database not initialized. Call initDatabase() first.');
  return db;
}

module.exports = { initDatabase, getDb, saveDatabase, DB_PATH };

if (require.main === module) {
  initDatabase().then(() => { console.log('Done.'); process.exit(0); });
}
