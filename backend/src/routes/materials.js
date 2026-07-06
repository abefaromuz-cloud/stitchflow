const express = require('express');
const pool = require('../db/pool');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

router.get('/alerts/low-stock', authenticate, async (req, res) => {
  try {
    res.json((await pool.query('SELECT * FROM materials WHERE quantity_in_stock<=min_stock_level ORDER BY name')).rows);
  } catch (err) { res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
});

router.get('/', authenticate, async (req, res) => {
  try {
    const result = await pool.query(`SELECT m.*, CASE WHEN m.quantity_in_stock<=m.min_stock_level THEN true ELSE false END AS low_stock, c.company_name AS client_name, o.order_number FROM materials m LEFT JOIN clients c ON c.id=m.client_id LEFT JOIN orders o ON o.id=m.order_id ORDER BY m.category, m.name`);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
});

router.post('/', authenticate, async (req, res) => {
  const { name, category, unit, quantity_in_stock, min_stock_level, unit_cost, supplier, client_id, order_id, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'Название обязательно' });
  try {
    const result = await pool.query(
      `INSERT INTO materials (name,category,unit,quantity_in_stock,min_stock_level,unit_cost,supplier,client_id,order_id,notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [name, category||'other', unit||'pcs', quantity_in_stock||0, min_stock_level||0, unit_cost||0, supplier||null, client_id||null, order_id||null, notes||null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
});

router.put('/:id', authenticate, async (req, res) => {
  const { name, category, unit, min_stock_level, unit_cost, supplier, client_id, order_id, notes } = req.body;
  try {
    const result = await pool.query(
      `UPDATE materials SET name=COALESCE($1,name), category=COALESCE($2,category), unit=COALESCE($3,unit), min_stock_level=COALESCE($4,min_stock_level), unit_cost=COALESCE($5,unit_cost), supplier=COALESCE($6,supplier), client_id=COALESCE($7,client_id), order_id=COALESCE($8,order_id), notes=COALESCE($9,notes) WHERE id=$10 RETURNING *`,
      [name||null,category||null,unit||null,min_stock_level||null,unit_cost||null,supplier||null,client_id||null,order_id||null,notes||null,req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
});

router.post('/:id/movements', authenticate, async (req, res) => {
  const { movement_type, quantity, order_id, reason } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`INSERT INTO material_movements (material_id,movement_type,quantity,order_id,reason,created_by) VALUES ($1,$2,$3,$4,$5,$6)`, [req.params.id,movement_type,quantity,order_id||null,reason||null,req.user.id]);
    const delta = movement_type==='in' ? quantity : -quantity;
    const result = await client.query(`UPDATE materials SET quantity_in_stock=quantity_in_stock+$1 WHERE id=$2 RETURNING *`, [delta,req.params.id]);
    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  } finally { client.release(); }
});

module.exports = router;
