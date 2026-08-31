require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase } = require('./database');

const authRoutes = require('./routes/auth');
const equipmentRoutes = require('./routes/equipment');
const ticketRoutes = require('./routes/tickets');
const labRoutes = require('./routes/labs');
const categoryRoutes = require('./routes/categories');
const maintenanceRoutes = require('./routes/maintenance');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/auth', authRoutes);
app.use('/api/equipment', equipmentRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/labs', labRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/maintenance', maintenanceRoutes);

app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  }
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error.' });
});

async function start() {
  await initDatabase();

  const { wrapDb } = require('./db-helper');
  const { getDb, saveDatabase } = require('./database');
  const bcrypt = require('bcryptjs');
  const db = wrapDb(getDb());
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;

  if (userCount === 0) {
    console.log('First run detected. Seeding database...');
    const hashPassword = (pwd) => bcrypt.hashSync(pwd, 10);

    db.prepare('INSERT INTO users (full_name, email, password, role, department) VALUES (?, ?, ?, ?, ?)').run('System Administrator', 'admin@chs.edu.ph', hashPassword('admin123'), 'admin', 'IT Department');
    db.prepare('INSERT INTO users (full_name, email, password, role, department) VALUES (?, ?, ?, ?, ?)').run('Juan Dela Cruz', 'custodian@chs.edu.ph', hashPassword('custodian123'), 'custodian', 'Computer Laboratory');
    db.prepare('INSERT INTO users (full_name, email, password, role, department) VALUES (?, ?, ?, ?, ?)').run('Maria Santos', 'tech@chs.edu.ph', hashPassword('tech123'), 'technician', 'Maintenance Department');

    db.prepare('INSERT INTO laboratories (name, building, capacity, description) VALUES (?, ?, ?, ?)').run('Computer Lab 1', 'Main Building', 40, 'Main computer laboratory');
    db.prepare('INSERT INTO laboratories (name, building, capacity, description) VALUES (?, ?, ?, ?)').run('Computer Lab 2', 'Main Building', 40, 'Secondary computer laboratory');
    db.prepare('INSERT INTO laboratories (name, building, capacity, description) VALUES (?, ?, ?, ?)').run('Computer Lab 3', 'Annex Building', 30, 'IT specialized laboratory');
    db.prepare('INSERT INTO laboratories (name, building, capacity, description) VALUES (?, ?, ?, ?)').run('Library Computer Area', 'Library Building', 20, 'Open-access computers');

    ['Desktop Computer', 'Monitor', 'Keyboard', 'Mouse', 'Router/Switch', 'UPS', 'Printer', 'Furniture'].forEach(c => {
      db.prepare('INSERT INTO equipment_categories (name) VALUES (?)').run(c);
    });

    const brands = ['Dell', 'HP', 'Lenovo', 'Acer'];
    const models = ['OptiPlex 3080', 'ProDesk 400', 'ThinkCentre M70s', 'Veriton X2640'];
    let tag = 1;
    for (let lab = 1; lab <= 3; lab++) {
      for (let i = 0; i < 30; i++) {
        const status = ['working','working','working','working','under_maintenance','defective'][Math.floor(Math.random()*6)];
        const ram = Math.floor(Math.random()*3+8);
        const ssd = Math.floor(Math.random()*3+128);
        db.prepare('INSERT INTO equipment (asset_tag, serial_number, category_id, brand, model, specifications, laboratory_id, status, date_acquired, unit_cost) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
          `CHS-LAB${lab}-${String(tag).padStart(4,'0')}`, `SN-${tag}`, 1,
          brands[Math.floor(Math.random()*4)], models[Math.floor(Math.random()*4)],
          `Intel Core i5, ${ram}GB RAM, ${ssd}GB SSD`, lab, status,
          `2024-${String(Math.floor(Math.random()*12)+1).padStart(2,'0')}-${String(Math.floor(Math.random()*28)+1).padStart(2,'0')}`,
          Math.floor(Math.random()*20000+25000)
        );
        tag++;
      }
    }

    saveDatabase();
    console.log('Database seeded successfully!');
  }

  app.listen(PORT, () => {
    console.log(`\n  Cabiao SHS Lab Inventory System`);
    console.log(`  Server running at http://localhost:${PORT}`);
    console.log(`  Admin: admin@chs.edu.ph / admin123\n`);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
