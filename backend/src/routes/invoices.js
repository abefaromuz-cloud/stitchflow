const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../db/pool');
const { authenticate } = require('../middleware/auth');
const { generateInvoicePdf } = require('../utils/pdf');
const { notifySubscribers } = require('../utils/telegram');

const router = express.Router();

// GET /api/invoices - список счетов
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT i.*, c.company_name AS client_name, o.order_number
      FROM invoices i
      JOIN clients c ON c.id = i.client_id
      LEFT JOIN orders o ON o.id = i.order_id
      ORDER BY i.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// GET /api/invoices/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT i.*, c.company_name AS client_name, o.order_number
      FROM invoices i
      JOIN clients c ON c.id = i.client_id
      LEFT JOIN orders o ON o.id = i.order_id
      WHERE i.id = $1
    `, [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Счет не найден' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// POST /api/invoices - создать счет (можно на основе заказа)
router.post(
  '/',
  authenticate,
  [
    body('invoice_number').notEmpty().withMessage('Номер счета обязателен'),
    body('client_id').isUUID().withMessage('Некорректный клиент'),
    body('amount').isFloat({ gt: 0 }).withMessage('Сумма должна быть больше 0')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { invoice_number, order_id, client_id, amount, discount_percent, due_date } = req.body;

    // Если скидка не передана, берем скидку клиента
    let finalDiscount = discount_percent;
    if (finalDiscount === undefined || finalDiscount === null) {
      const clientResult = await pool.query('SELECT discount_percent FROM clients WHERE id = $1', [client_id]);
      finalDiscount = clientResult.rows[0]?.discount_percent || 0;
    }

    const totalAfterDiscount = Number(amount) - (Number(amount) * Number(finalDiscount) / 100);
    const qrData = `stitchflow://pay?invoice=${invoice_number}&amount=${totalAfterDiscount.toFixed(2)}`;

    try {
      const result = await pool.query(
        `INSERT INTO invoices (invoice_number, order_id, client_id, amount, discount_percent, due_date, payment_qr_data, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [invoice_number, order_id || null, client_id, amount, finalDiscount, due_date || null, qrData, req.user.id]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error(err);
      if (err.code === '23505') {
        return res.status(409).json({ error: 'Счет с таким номером уже существует' });
      }
      res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
  }
);

// PUT /api/invoices/:id/status - изменить статус (paid/cancelled/overdue)
router.put('/:id/status', authenticate, async (req, res) => {
  const { status } = req.body;
  if (!['unpaid', 'paid', 'overdue', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Некорректный статус' });
  }
  try {
    const result = await pool.query(
      `UPDATE invoices SET status = $1, paid_at = CASE WHEN $1 = 'paid' THEN now() ELSE paid_at END
       WHERE id = $2 RETURNING *`,
      [status, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Счет не найден' });

    if (status === 'paid') {
      const inv = result.rows[0];
      notifySubscribers(
        'payment_received',
        `💰 <b>Оплата получена</b>\nСчет №${inv.invoice_number}\nСумма: $${Number(inv.total_amount).toLocaleString()}`,
        { invoice_id: inv.id, invoice_number: inv.invoice_number }
      ).catch(() => {});
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// GET /api/invoices/:id/pdf - сгенерировать и скачать PDF счета
router.get('/:id/pdf', authenticate, async (req, res) => {
  try {
    const invoiceResult = await pool.query('SELECT * FROM invoices WHERE id = $1', [req.params.id]);
    const invoice = invoiceResult.rows[0];
    if (!invoice) return res.status(404).json({ error: 'Счет не найден' });

    const clientResult = await pool.query('SELECT * FROM clients WHERE id = $1', [invoice.client_id]);
    const companyResult = await pool.query('SELECT * FROM company_profile LIMIT 1');

    let order = null;
    if (invoice.order_id) {
      const orderResult = await pool.query('SELECT * FROM orders WHERE id = $1', [invoice.order_id]);
      order = orderResult.rows[0] || null;
    }

    const pdfBuffer = await generateInvoicePdf(invoice, clientResult.rows[0], companyResult.rows[0], order);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="invoice-${invoice.invoice_number}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;
