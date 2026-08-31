const express = require('express');
const { getDb, saveDatabase } = require('../database');
const { wrapDb } = require('../db-helper');
const { authenticateToken } = require('../middleware/auth');
const { stringify } = require('csv-stringify/sync');
const PDFDocument = require('pdfkit');

const router = express.Router();
router.use(authenticateToken);

router.get('/', (req, res) => {
  const { laboratory_id, category_id, status, search, page = 1, limit = 50 } = req.query;
  try {
    const db = wrapDb(getDb());
    let where = [];
    let params = [];

    if (laboratory_id) { where.push('e.laboratory_id = ?'); params.push(Number(laboratory_id)); }
    if (category_id) { where.push('e.category_id = ?'); params.push(Number(category_id)); }
    if (status) { where.push('e.status = ?'); params.push(status); }
    if (search) {
      where.push('(e.asset_tag LIKE ? OR e.serial_number LIKE ? OR e.brand LIKE ? OR e.model LIKE ?)');
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const countResult = db.prepare(`SELECT COUNT(*) as total FROM equipment e ${whereClause}`).get(...params);
    const items = db.prepare(`
      SELECT e.*, ec.name as category_name, l.name as lab_name
      FROM equipment e
      LEFT JOIN equipment_categories ec ON e.category_id = ec.id
      LEFT JOIN laboratories l ON e.laboratory_id = l.id
      ${whereClause}
      ORDER BY e.asset_tag
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

router.get('/stats', (req, res) => {
  try {
    const db = wrapDb(getDb());
    const total = db.prepare('SELECT COUNT(*) as count FROM equipment').get().count;
    const working = db.prepare("SELECT COUNT(*) as count FROM equipment WHERE status = 'working'").get().count;
    const maintenance = db.prepare("SELECT COUNT(*) as count FROM equipment WHERE status = 'under_maintenance'").get().count;
    const defective = db.prepare("SELECT COUNT(*) as count FROM equipment WHERE status = 'defective'").get().count;
    const condemned = db.prepare("SELECT COUNT(*) as count FROM equipment WHERE status = 'condemned'").get().count;

    const pendingTickets = db.prepare("SELECT COUNT(*) as count FROM tickets WHERE status IN ('pending','in_progress')").get().count;
    const resolvedTickets = db.prepare("SELECT COUNT(*) as count FROM tickets WHERE status = 'resolved'").get().count;

    const byLab = db.prepare(`
      SELECT l.name, COUNT(e.id) as count,
        SUM(CASE WHEN e.status = 'working' THEN 1 ELSE 0 END) as working,
        SUM(CASE WHEN e.status = 'defective' THEN 1 ELSE 0 END) as defective,
        SUM(CASE WHEN e.status = 'under_maintenance' THEN 1 ELSE 0 END) as maintenance
      FROM laboratories l
      LEFT JOIN equipment e ON l.id = e.laboratory_id
      GROUP BY l.id ORDER BY l.name
    `).all();

    const byCategory = db.prepare(`
      SELECT ec.name, COUNT(e.id) as count
      FROM equipment_categories ec
      LEFT JOIN equipment e ON ec.id = e.category_id
      GROUP BY ec.id ORDER BY ec.name
    `).all();

    const recentTickets = db.prepare(`
      SELECT t.*, e.asset_tag, l.name as lab_name, u.full_name as reporter_name
      FROM tickets t
      LEFT JOIN equipment e ON t.equipment_id = e.id
      LEFT JOIN laboratories l ON t.laboratory_id = l.id
      LEFT JOIN users u ON t.reported_by = u.id
      ORDER BY t.created_at DESC LIMIT 5
    `).all();

    res.json({ total, working, maintenance, defective, condemned, pendingTickets, resolvedTickets, byLab, byCategory, recentTickets });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.get('/export/csv', (req, res) => {
  const { laboratory_id } = req.query;
  try {
    const db = wrapDb(getDb());
    let where = '';
    let params = [];
    if (laboratory_id) { where = 'WHERE e.laboratory_id = ?'; params.push(Number(laboratory_id)); }

    const items = db.prepare(`
      SELECT e.asset_tag, e.serial_number, ec.name as category, e.brand, e.model,
        e.specifications, l.name as laboratory, e.status, e.date_acquired, e.unit_cost, e.remarks
      FROM equipment e
      LEFT JOIN equipment_categories ec ON e.category_id = ec.id
      LEFT JOIN laboratories l ON e.laboratory_id = l.id
      ${where} ORDER BY e.asset_tag
    `).all(...params);

    const csv = stringify(items, { header: true });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=equipment_inventory.csv');
    res.send(csv);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.get('/export/pdf', (req, res) => {
  const { laboratory_id } = req.query;
  try {
    const db = wrapDb(getDb());
    let where = '';
    let params = [];
    if (laboratory_id) { where = 'WHERE e.laboratory_id = ?'; params.push(Number(laboratory_id)); }

    const items = db.prepare(`
      SELECT e.asset_tag, e.serial_number, ec.name as category, e.brand, e.model,
        e.specifications, l.name as laboratory, e.status, e.date_acquired
      FROM equipment e
      LEFT JOIN equipment_categories ec ON e.category_id = ec.id
      LEFT JOIN laboratories l ON e.laboratory_id = l.id
      ${where} ORDER BY e.asset_tag
    `).all(...params);

    const doc = new PDFDocument({ layout: 'landscape', margin: 30 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=equipment_inventory.pdf');
    doc.pipe(res);

    doc.fontSize(16).text('Cabiao Senior High School', { align: 'center' });
    doc.fontSize(12).text('Computer Laboratory Equipment Inventory', { align: 'center' });
    doc.moveDown();
    doc.fontSize(8).text(`Generated: ${new Date().toLocaleDateString()}`, { align: 'right' });
    doc.moveDown();

    const headers = ['Asset Tag', 'Serial No.', 'Category', 'Brand', 'Model', 'Laboratory', 'Status', 'Date Acquired'];
    const colWidths = [80, 80, 80, 60, 80, 100, 70, 70];
    let y = doc.y;
    let x = 30;

    doc.fontSize(7).font('Helvetica-Bold');
    headers.forEach((h, i) => { doc.text(h, x, y, { width: colWidths[i] }); x += colWidths[i]; });
    doc.moveDown();
    y = doc.y;

    doc.font('Helvetica');
    items.forEach(item => {
      if (y > 550) { doc.addPage(); y = 30; }
      x = 30;
      const vals = [item.asset_tag, item.serial_number, item.category, item.brand, item.model, item.laboratory, item.status, item.date_acquired];
      vals.forEach((v, i) => { doc.text(String(v || ''), x, y, { width: colWidths[i] }); x += colWidths[i]; });
      y += 14;
    });

    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.get('/:id', (req, res) => {
  try {
    const db = wrapDb(getDb());
    const item = db.prepare(`
      SELECT e.*, ec.name as category_name, l.name as lab_name
      FROM equipment e
      LEFT JOIN equipment_categories ec ON e.category_id = ec.id
      LEFT JOIN laboratories l ON e.laboratory_id = l.id
      WHERE e.id = ?
    `).get(Number(req.params.id));

    if (!item) return res.status(404).json({ error: 'Equipment not found.' });

    const logs = db.prepare(`
      SELECT ml.*, u.full_name as technician_name
      FROM maintenance_logs ml LEFT JOIN users u ON ml.performed_by = u.id
      WHERE ml.equipment_id = ? ORDER BY ml.maintenance_date DESC
    `).all(Number(req.params.id));

    res.json({ ...item, maintenance_logs: logs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.post('/', (req, res) => {
  const { asset_tag, serial_number, category_id, brand, model, specifications, laboratory_id, status, date_acquired, unit_cost, remarks } = req.body;
  if (!asset_tag) return res.status(400).json({ error: 'Asset tag is required.' });

  try {
    const db = wrapDb(getDb());
    const result = db.prepare(`
      INSERT INTO equipment (asset_tag, serial_number, category_id, brand, model, specifications, laboratory_id, status, date_acquired, unit_cost, remarks)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(asset_tag, serial_number || '', category_id || null, brand || '', model || '', specifications || '', laboratory_id || null, status || 'working', date_acquired || null, unit_cost || 0, remarks || '');

    saveDatabase();
    res.status(201).json({ id: result.lastInsertRowid, message: 'Equipment added successfully.' });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Asset tag already exists.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.put('/:id', (req, res) => {
  const { asset_tag, serial_number, category_id, brand, model, specifications, laboratory_id, status, date_acquired, unit_cost, remarks } = req.body;

  try {
    const db = wrapDb(getDb());
    const existing = db.prepare('SELECT id FROM equipment WHERE id = ?').get(Number(req.params.id));
    if (!existing) return res.status(404).json({ error: 'Equipment not found.' });

    db.prepare(`
      UPDATE equipment SET asset_tag=?, serial_number=?, category_id=?, brand=?, model=?, specifications=?,
        laboratory_id=?, status=?, date_acquired=?, unit_cost=?, remarks=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(asset_tag, serial_number || '', category_id || null, brand || '', model || '', specifications || '', laboratory_id || null, status, date_acquired || null, unit_cost || 0, remarks || '', Number(req.params.id));

    saveDatabase();
    res.json({ message: 'Equipment updated successfully.' });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Asset tag already exists.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const db = wrapDb(getDb());
    const result = db.prepare('DELETE FROM equipment WHERE id = ?').run(Number(req.params.id));
    if (result.changes === 0) return res.status(404).json({ error: 'Equipment not found.' });
    saveDatabase();
    res.json({ message: 'Equipment deleted successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
