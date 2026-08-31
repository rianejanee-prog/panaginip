const express = require('express');
const { getDb } = require('../database');
const { wrapDb } = require('../db-helper');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

router.get('/', (req, res) => {
  try {
    const db = wrapDb(getDb());
    const cats = db.prepare(`
      SELECT ec.*, COUNT(e.id) as equipment_count
      FROM equipment_categories ec LEFT JOIN equipment e ON ec.id = e.category_id
      GROUP BY ec.id ORDER BY ec.name
    `).all();
    res.json(cats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
