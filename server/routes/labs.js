const express = require('express');
const { getDb } = require('../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

router.get('/', (req, res) => {
  const db = getDb();
  try {
    const labs = db.prepare(`
      SELECT l.*, COUNT(e.id) as equipment_count
      FROM laboratories l
      LEFT JOIN equipment e ON l.id = e.laboratory_id
      GROUP BY l.id ORDER BY l.name
    `).all();
    res.json(labs);
  } finally { db.close(); }
});

router.get('/:id', (req, res) => {
  const db = getDb();
  try {
    const lab = db.prepare('SELECT * FROM laboratories WHERE id = ?').get(req.params.id);
    if (!lab) return res.status(404).json({ error: 'Laboratory not found.' });
    res.json(lab);
  } finally { db.close(); }
});

module.exports = router;
