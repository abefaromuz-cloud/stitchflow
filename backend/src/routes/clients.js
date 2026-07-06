const express = require('express');
const pool = require('../db/pool');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  try {
    const result = await pool.query(`SELECT c.*, COALESCE(SUM(o.total_amount),0) AS total_orders_amount, COUNT(o.id) AS orders_count FROM clients c LEFT JOIN orders o ON o.client_id=c.id GROUP BY c.id ORDER BY c.created_at DESC`);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const [c, o] = await Promise.all([
      pool.query('SELECT * FROM clients WHERE id=$1', [req.params.id]),
      pool.query('SELECT * FROM orders WHERE client_id=$1 ORDER BY created_at DESC', [req.params.id]),
    ]);
    if (!c.rows[0]) return res.status(404).json({ error: 'Клиент не найден' });
    res.json({ ...c.rows[0], orders: o.rows });
  } catch (err) { res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
});

router.post('/', authenticate, async (req, res) => {
  const { company_name, contact_person, phone, whatsapp, telegram, email, discount_percent, notes } = req.body;
  if (!company_name) return res.status(400).json({ error: 'Название компании обязательно' });
  try {
    const result = await pool.query(
      `INSERT INTO clients (company_name,contact_person,phone,whatsapp,telegram,email,discount_percent,notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [company_name, contact_person||null, phone||null, whatsapp||null, telegram||null, email||null, discount_percent||0, notes||null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
});

router.put('/:id', authenticate, async (req, res) => {
  const { company_name, contact_person, phone, whatsapp, telegram, email, discount_percent, debt_amount, notes } = req.body;
  try {
    const result = await pool.query(
      `UPDATE clients SET company_name=COALESCE($1,company_name), contact_person=COALESCE($2,contact_person), phone=COALESCE($3,phone), whatsapp=COALESCE($4,whatsapp), telegram=COALESCE($5,telegram), email=COALESCE($6,email), discount_percent=COALESCE($7,discount_percent), debt_amount=COALESCE($8,debt_amount), notes=COALESCE($9,notes) WHERE id=$10 RETURNING *`,
      [company_name||null, contact_person||null, phone||null, whatsapp||null, telegram||null, email||null, discount_percent||null, debt_amount||null, notes||null, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Клиент не найден' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    await pool.query('DELETE FROM clients WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
});

module.exports = router;
