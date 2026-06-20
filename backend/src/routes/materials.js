const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

const CATEGORY_LABELS = {
  fabric: 'Ткани',
  thread: 'Нитки',
  buttons: 'Пуговицы',
  zippers: 'Молнии',
  other: 'Фурнитура'
};

// GET /api/materials - список материалов с признаком низкого остатка
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *,
        CASE WHEN quantity_in_stock <= min_stock_level THEN true ELSE false END AS low_stock,
        CASE WHEN category = ANY($1::text[]) THEN category ELSE category END AS category
      FROM materials
      ORDER BY category, name
    `, [Object.keys(CATEGORY_LABELS)]);

    res.json(result.rows.map(m => ({ ...m, category_label: CATEGORY_LABELS[m.category] || m.category })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// GET /api/materials/:id - карточка материала с историей движений
router.get('/:id', authenticate, async (req, res) => {
  try {
    const materialResult = await pool.query('SELECT * FROM materials WHERE id = $1', [req.params.id]);
    if (!materialResult.rows[0]) return res.status(404).json({ error: 'Материал не найден' });

    const movementsResult = await pool.query(`
      SELECT mm.*, o.order_number
      FROM material_movements mm
      LEFT JOIN orders o ON o.id = mm.order_id
      WHERE mm.material_id = $1
      ORDER BY mm.created_at DESC
      LIMIT 50
    `, [req.params.id]);

    res.json({ ...materialResult.rows[0], movements: movementsResult.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// POST /api/materials - создать материал
router.post(
  '/',
  authenticate,
  [
    body('name').notEmpty().withMessage('Название обязательно'),
    body('category').isIn(['fabric', 'thread', 'buttons', 'zippers', 'other']).withMessage('Некорректная категория'),
    body('unit').notEmpty().withMessage('Единица измерения обязательна')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, category, unit, quantity_in_stock, min_stock_level, unit_cost, supplier, notes } = req.body;
    try {
      const result = await pool.query(
        `INSERT INTO materials (name, category, unit, quantity_in_stock, min_stock_level, unit_cost, supplier, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [name, category, unit, quantity_in_stock || 0, min_stock_level || 0, unit_cost || 0, supplier, notes]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
  }
);

// PUT /api/materials/:id
router.put('/:id', authenticate, async (req, res) => {
  const { name, category, unit, min_stock_level, unit_cost, supplier, notes } = req.body;
  try {
    const result = await pool.query(
      `UPDATE materials SET
        name = COALESCE($1, name),
        category = COALESCE($2, category),
        unit = COALESCE($3, unit),
        min_stock_level = COALESCE($4, min_stock_level),
        unit_cost = COALESCE($5, unit_cost),
        supplier = COALESCE($6, supplier),
        notes = COALESCE($7, notes)
       WHERE id = $8 RETURNING *`,
      [name, category, unit, min_stock_level, unit_cost, supplier, notes, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Материал не найден' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// DELETE /api/materials/:id
router.delete('/:id', authenticate, requireRole('admin', 'manager'), async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM materials WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Материал не найден' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// POST /api/materials/:id/movements - поступление или ручная корректировка
router.post(
  '/:id/movements',
  authenticate,
  [
    body('movement_type').isIn(['in', 'out', 'adjustment']).withMessage('Некорректный тип движения'),
    body('quantity').isFloat({ gt: 0 }).withMessage('Количество должно быть больше 0')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { movement_type, quantity, order_id, reason } = req.body;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const movementResult = await client.query(
        `INSERT INTO material_movements (material_id, movement_type, quantity, order_id, reason, created_by)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [req.params.id, movement_type, quantity, order_id || null, reason, req.user.id]
      );

      const delta = movement_type === 'in' ? quantity : -quantity; // adjustment: трактуем как ручную установку через 'in'/'out' знак

      const materialResult = await client.query(
        `UPDATE materials SET quantity_in_stock = quantity_in_stock + $1 WHERE id = $2 RETURNING *`,
        [delta, req.params.id]
      );

      if (!materialResult.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Материал не найден' });
      }

      await client.query('COMMIT');
      res.status(201).json({ movement: movementResult.rows[0], material: materialResult.rows[0] });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(err);
      res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    } finally {
      client.release();
    }
  }
);

// GET /api/materials/alerts/low-stock - материалы с низким остатком
router.get('/alerts/low-stock', authenticate, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM materials WHERE quantity_in_stock <= min_stock_level ORDER BY name
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;
