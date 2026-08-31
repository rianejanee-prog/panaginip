const express = require('express');
const { getDb } = require('../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

router.get('/', (req, res) => {
  const { equipment_id, maintenance_type } = req.query;
  const db = getDb();
  try {
    let where = [];
    let params = [];
    if (equipment_id) { where.push('ml.equipment_id = ?'); params.push(equipment_id); }
    if (maintenance_type) { where.push('ml.maintenance_type = ?'); params.push(maintenance_type); }
    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const logs = db.prepare(`
      SELECT ml.*, e.asset_tag, u.full_name as technician_name
      FROM maintenance_logs ml
      LEFT JOIN equipment e ON ml.equipment_id = e.id
      LEFT JOIN users u ON ml.performed_by = u.id
      ${whereClause}
      ORDER BY ml.maintenance_date DESC
    `).all(...params);
    res.json(logs);
  } finally { db.close(); }
});

router.post('/', (req, res) => {
  const { equipment_id, ticket_id, maintenance_type, description, parts_replaced, cost, maintenance_date } = req.body;
  if (!equipment_id || !maintenance_type || !description || !maintenance_date) {
    return res.status(400).json({ error: 'equipment_id, type, description, and date are required.' });
  }
  const db = getDb();
  try {
    const result = db.prepare(`
      INSERT INTO maintenance_logs (equipment_id, ticket_id, performed_by, maintenance_type, description, parts_replaced, cost, maintenance_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(equipment_id, ticket_id || null, req.user.id, maintenance_type, description, parts_replaced || '', cost || 0, maintenance_date);
    res.status(201).json({ id: result.lastInsertRowid, message: 'Maintenance log added.' });
  } finally { db.close(); }
});

module.exports = router;
