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

initDatabase();

app.listen(PORT, () => {
  console.log(`\n  Cabiao SHS Lab Inventory System`);
  console.log(`  Server running at http://localhost:${PORT}`);
  console.log(`  Admin: admin@chs.edu.ph / admin123\n`);
});
