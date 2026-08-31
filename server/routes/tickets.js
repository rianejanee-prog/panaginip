const express = require('express');
const { getDb, saveDatabase } = require('../database');
const { wrapDb } = require('../db-helper');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

function generateTicketNumber(db) {
  const year = new Date().getFullYear();
  const last = db.prepare("SELECT ticket_number FROM tickets WHERE ticket_number LIKE ? ORDER BY id DESC LIMIT 1").get(`TKT-${year}-%`);
  let num = 1;
  if (last && last.ticket_number) {
    const parts = last.ticket_number.split('-');
    num = parseInt(parts[2]) + 1;
  }
  return `TKT-${year}-${String(num).padStart(4, '0')}`;
}

router.get('/', (req, res) => {
  const { status, priority, laboratory_id, assigned_to, page = 1, limit = 50 } = req.query;
  try {
    const db = wrapDb(getDb());
    let where = [];
    let params = [];

    if (status) { where.push('t.status = ?'); params.push(status); }
    if (priority) { where.push('t.priority = ?'); params.push(priority); }
    if (laboratory_id) { where.push('t.laboratory_id = ?'); params.push(Number(laboratory_id)); }
    if (assigned_to) { where.push('t.assigned_to = ?'); params.push(Number(assigned_to)); }

    if (req.user.role === 'custodian') {
      where.push('t.reported_by = ?');
      params.push(req.user.id);
    }

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const countResult = db.prepare(`SELECT COUNT(*) as total FROM tickets t ${whereClause}`).get(...params);
    const items = db.prepare(`
      SELECT t.*, e.asset_tag, l.name as lab_name, u.full_name as reporter_name,
        tech.full_name as technician_name
      FROM tickets t
      LEFT JOIN equipment e ON t.equipment_id = e.id
      LEFT JOIN laboratories l ON t.laboratory_id = l.id
      LEFT JOIN users u ON t.reported_by = u.id
      LEFT JOIN users tech ON t.assigned_to = tech.id
      ${whereClause}
      ORDER BY
        CASE t.priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
        t.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), offset);

    res.json({
      items,
      total: countResult ? countResult.total : 0,
      page: parseInt(page),
      pages: Math.ceil((countResult ? countResult.total : 0) / parseInt(limit))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.get('/:id', (req, res) => {
  try {
    const db = wrapDb(getDb());
    const ticket = db.prepare(`
      SELECT t.*, e.asset_tag, l.name as lab_name, u.full_name as reporter_name,
        tech.full_name as technician_name
      FROM tickets t
      LEFT JOIN equipment e ON t.equipment_id = e.id
      LEFT JOIN laboratories l ON t.laboratory_id = l.id
      LEFT JOIN users u ON t.reported_by = u.id
      LEFT JOIN users tech ON t.assigned_to = tech.id
      WHERE t.id = ?
    `).get(Number(req.params.id));

    if (!ticket) return res.status(404).json({ error: 'Ticket not found.' });

    const logs = db.prepare(`
      SELECT ml.*, u.full_name as technician_name
      FROM maintenance_logs ml LEFT JOIN users u ON ml.performed_by = u.id
      WHERE ml.ticket_id = ? ORDER BY ml.maintenance_date DESC
    `).all(Number(req.params.id));

    res.json({ ...ticket, logs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.post('/', (req, res) => {
  const { equipment_id, laboratory_id, title, description, priority } = req.body;
  if (!title || !description) return res.status(400).json({ error: 'Title and description are required.' });

  try {
    const db = wrapDb(getDb());
    const ticket_number = generateTicketNumber(db);
    const result = db.prepare(`
      INSERT INTO tickets (ticket_number, equipment_id, laboratory_id, reported_by, title, description, priority, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
    `).run(ticket_number, equipment_id || null, laboratory_id || null, req.user.id, title, description, priority || 'medium');

    saveDatabase();
    res.status(201).json({ id: result.lastInsertRowid, ticket_number, message: 'Ticket created successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.put('/:id', (req, res) => {
  const { status, assigned_to, resolution_notes, priority } = req.body;

  try {
    const db = wrapDb(getDb());
    const existing = db.prepare('SELECT * FROM tickets WHERE id = ?').get(Number(req.params.id));
    if (!existing) return res.status(404).json({ error: 'Ticket not found.' });

    let updates = [];
    let params = [];

    if (status) { updates.push('status = ?'); params.push(status); }
    if (assigned_to !== undefined) { updates.push('assigned_to = ?'); params.push(assigned_to || null); }
    if (resolution_notes !== undefined) { updates.push('resolution_notes = ?'); params.push(resolution_notes); }
    if (priority) { updates.push('priority = ?'); params.push(priority); }

    if (status === 'resolved' || status === 'unrepairable') {
      updates.push('resolved_at = CURRENT_TIMESTAMP');
    }
    updates.push('updated_at = CURRENT_TIMESTAMP');

    params.push(Number(req.params.id));
    db.prepare(`UPDATE tickets SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    saveDatabase();
    res.json({ message: 'Ticket updated successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.post('/:id/logs', (req, res) => {
  const { maintenance_type, description, parts_replaced, cost, maintenance_date } = req.body;
  if (!maintenance_type || !description || !maintenance_date) {
    return res.status(400).json({ error: 'Maintenance type, description, and date are required.' });
  }

  try {
    const db = wrapDb(getDb());
    const ticket = db.prepare('SELECT equipment_id FROM tickets WHERE id = ?').get(Number(req.params.id));
    if (!ticket) return res.status(404).json({ error: 'Ticket not found.' });

    const result = db.prepare(`
      INSERT INTO maintenance_logs (equipment_id, ticket_id, performed_by, maintenance_type, description, parts_replaced, cost, maintenance_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(ticket.equipment_id, Number(req.params.id), req.user.id, maintenance_type, description, parts_replaced || '', cost || 0, maintenance_date);

    if (ticket.equipment_id) {
      db.prepare("UPDATE equipment SET status = 'working', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(ticket.equipment_id);
    }

    saveDatabase();
    res.status(201).json({ id: result.lastInsertRowid, message: 'Maintenance log added.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
