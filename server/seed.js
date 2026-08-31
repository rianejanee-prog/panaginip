const { initDatabase, getDb } = require('./database');
const bcrypt = require('bcryptjs');

function seed() {
  initDatabase();
  const db = getDb();

  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount > 0) {
    console.log('Database already seeded. Skipping.');
    db.close();
    return;
  }

  const hashPassword = (pwd) => bcrypt.hashSync(pwd, 10);

  const insertUser = db.prepare(
    'INSERT INTO users (full_name, email, password, role, department) VALUES (?, ?, ?, ?, ?)'
  );

  const insertUserTx = db.transaction((users) => {
    for (const u of users) insertUser.run(...u);
  });

  insertUserTx([
    ['System Administrator', 'admin@chs.edu.ph', hashPassword('admin123'), 'admin', 'IT Department'],
    ['Juan Dela Cruz', 'custodian@chs.edu.ph', hashPassword('custodian123'), 'custodian', 'Computer Laboratory'],
    ['Maria Santos', 'tech@chs.edu.ph', hashPassword('tech123'), 'technician', 'Maintenance Department'],
    ['Pedro Reyes', 'custodian2@chs.edu.ph', hashPassword('custodian123'), 'custodian', 'Computer Laboratory'],
    ['Ana Garcia', 'tech2@chs.edu.ph', hashPassword('tech123'), 'technician', 'Maintenance Department'],
  ]);

  const insertLab = db.prepare(
    'INSERT INTO laboratories (name, building, capacity, description) VALUES (?, ?, ?, ?)'
  );
  const insertLabTx = db.transaction((labs) => {
    for (const l of labs) insertLab.run(...l);
  });

  insertLabTx([
    ['Computer Lab 1', 'Main Building', 40, 'Main computer laboratory with desktop units'],
    ['Computer Lab 2', 'Main Building', 40, 'Secondary computer laboratory'],
    ['Computer Lab 3', 'Annex Building', 30, 'IT specialized laboratory'],
    ['Library Computer Area', 'Library Building', 20, 'Open-access computers for research'],
  ]);

  const insertCat = db.prepare(
    'INSERT INTO equipment_categories (name) VALUES (?)'
  );
  const cats = ['Desktop Computer', 'Monitor', 'Keyboard', 'Mouse', 'Router/Switch', 'UPS', 'Printer', 'Furniture'];
  const insertCatTx = db.transaction((categories) => {
    for (const c of categories) insertCat.run(c);
  });
  insertCatTx(cats);

  const insertEquip = db.prepare(`
    INSERT INTO equipment (asset_tag, serial_number, category_id, brand, model, specifications, laboratory_id, status, date_acquired, unit_cost, remarks)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const equipmentData = [];
  let tagNum = 1;

  for (let lab = 1; lab <= 4; lab++) {
    const count = lab === 4 ? 20 : 30;
    for (let i = 0; i < count; i++) {
      const statuses = ['working', 'working', 'working', 'working', 'under_maintenance', 'defective'];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      equipmentData.push([
        `CHS-LAB${lab}-${String(tagNum).padStart(4, '0')}`,
        `SN-${Date.now()}-${tagNum}`,
        1,
        ['Dell', 'HP', 'Lenovo', 'Acer'][Math.floor(Math.random() * 4)],
        ['OptiPlex 3080', 'ProDesk 400', 'ThinkCentre M70s', 'Veriton X2640'][Math.floor(Math.random() * 4)],
        `Intel Core i${Math.floor(Math.random() * 3) + 5}, ${Math.floor(Math.random() * 3 + 8)}GB RAM, ${Math.floor(Math.random() * 3 + 128)}GB SSD`,
        lab,
        status,
        `2024-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`,
        Math.floor(Math.random() * 20000 + 25000),
        ''
      ]);
      tagNum++;
    }
  }

  const insertEquipTx = db.transaction((items) => {
    for (const e of items) insertEquip.run(...e);
  });
  insertEquipTx(equipmentData);

  const insertTicket = db.prepare(`
    INSERT INTO tickets (ticket_number, equipment_id, laboratory_id, reported_by, assigned_to, title, description, priority, status, resolution_notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const ticketData = [
    ['TKT-2026-0001', 1, 1, 2, 3, 'Blue Screen Error', 'Computer displays BSOD with MEMORY_MANAGEMENT error code', 'high', 'resolved', 'Replaced faulty RAM module'],
    ['TKT-2026-0002', 5, 1, 2, 3, 'No Display Output', 'Monitor shows no signal even when PC is on', 'medium', 'in_progress', ''],
    ['TKT-2026-0003', 12, 2, 4, 5, 'Keyboard Not Responding', 'Some keys on the keyboard are not functioning', 'low', 'pending', ''],
    ['TKT-2026-0004', 25, 3, 2, 3, 'Network Connectivity Issue', 'Cannot connect to the internet in Lab 3', 'critical', 'pending', ''],
    ['TKT-2026-0005', 33, 4, 4, 5, 'System Running Slow', 'Computer takes too long to boot and open applications', 'medium', 'resolved', 'Cleaned dust, reinstalled OS'],
  ];

  const insertTicketTx = db.transaction((tickets) => {
    for (const t of tickets) insertTicket.run(...t);
  });
  insertTicketTx(ticketData);

  const insertLog = db.prepare(`
    INSERT INTO maintenance_logs (equipment_id, ticket_id, performed_by, maintenance_type, description, parts_replaced, cost, maintenance_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const logData = [
    [1, 1, 3, 'repair', 'Replaced faulty 8GB DDR4 RAM module', '8GB DDR4 RAM', 2500, '2026-01-15'],
    [5, 2, 3, 'inspection', 'Inspected display cable and graphics card connections', '', 0, '2026-02-01'],
    [33, 5, 5, 'repair', 'Full system cleaning, thermal paste replacement, OS reinstall', 'Thermal paste', 500, '2026-01-20'],
    [10, null, 3, 'cleaning', 'Quarterly maintenance cleaning of all units in Lab 1', '', 0, '2026-03-01'],
    [20, null, 5, 'inspection', 'Annual hardware inspection and inventory check', '', 0, '2026-02-15'],
  ];

  const insertLogTx = db.transaction((logs) => {
    for (const l of logs) insertLog.run(...l);
  });
  insertLogTx(logData);

  console.log('Seed data inserted successfully!');
  console.log('Default admin login: admin@chs.edu.ph / admin123');
  console.log('Custodian login: custodian@chs.edu.ph / custodian123');
  console.log('Technician login: tech@chs.edu.ph / tech123');
  db.close();
}

seed();
