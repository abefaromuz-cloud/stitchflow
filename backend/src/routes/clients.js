const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../db/pool');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/clients - список клиентов с суммой заказов
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*,
        COALESCE(SUM(o.total_amount), 0) AS total_orders_amount,
        COUNT(o.id) AS orders_count
      FROM clients c
      LEFT JOIN orders o ON o.client_id = c.id
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// GET /api/clients/:id - карточка клиента с историей заказов
router.get('/:id', authenticate, async (req, res) => {
  try {
    const clientResult = await pool.query('SELECT * FROM clients WHERE id = $1', [req.params.id]);
    if (!clientResult.rows[0]) return res.status(404).json({ error: 'Клиент не найден' });

    const ordersResult = await pool.query(
      'SELECT * FROM orders WHERE client_id = $1 ORDER BY created_at DESC',
      [req.params.id]
    );

    res.json({ ...clientResult.rows[0], orders: ordersResult.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// POST /api/clients
router.post(
  '/',
  authenticate,
  [body('company_name').notEmpty().withMessage('Название компании обязательно')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { company_name, contact_person, phone, whatsapp, telegram, email, discount_percent, notes } = req.body;
    try {
      const result = await pool.query(
        `INSERT INTO clients (company_name, contact_person, phone, whatsapp, telegram, email, discount_percent, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [company_name, contact_person, phone, whatsapp, telegram, email, discount_percent || 0, notes]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
  }
);

// PUT /api/clients/:id
router.put('/:id', authenticate, async (req, res) => {
  const { company_name, contact_person, phone, whatsapp, telegram, email, discount_percent, debt_amount, notes } = req.body;
  try {
    const result = await pool.query(
      `UPDATE clients SET
        company_name = COALESCE($1, company_name),
        contact_person = COALESCE($2, contact_person),
        phone = COALESCE($3, phone),
        whatsapp = COALESCE($4, whatsapp),
        telegram = COALESCE($5, telegram),
        email = COALESCE($6, email),
        discount_percent = COALESCE($7, discount_percent),
        debt_amount = COALESCE($8, debt_amount),
        notes = COALESCE($9, notes)
       WHERE id = $10 RETURNING *`,
      [company_name, contact_person, phone, whatsapp, telegram, email, discount_percent, debt_amount, notes, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Клиент не найден' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// DELETE /api/clients/:id
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM clients WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Клиент не найден' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;
