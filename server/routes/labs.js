const express = require('express');
const { getDb } = require('../database');
const { wrapDb } = require('../db-helper');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

router.get('/', (req, res) => {
  try {
    const db = wrapDb(getDb());
    const labs = db.prepare(`
      SELECT l.*, COUNT(e.id) as equipment_count
      FROM laboratories l LEFT JOIN equipment e ON l.id = e.laboratory_id
      GROUP BY l.id ORDER BY l.name
    `).all();
    res.json(labs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.get('/:id', (req, res) => {
  try {
    const db = wrapDb(getDb());
    const lab = db.prepare('SELECT * FROM laboratories WHERE id = ?').get(Number(req.params.id));
    if (!lab) return res.status(404).json({ error: 'Laboratory not found.' });
    res.json(lab);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
