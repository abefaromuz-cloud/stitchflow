const express = require('express');
const pool = require('../db/pool');
const { authenticate } = require('../middleware/auth');
const { generateInvoicePdf } = require('../utils/pdf');
const { notifySubscribers } = require('../utils/telegram');
const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  try {
    res.json((await pool.query(`SELECT i.*, c.company_name AS client_name, o.order_number FROM invoices i JOIN clients c ON c.id=i.client_id LEFT JOIN orders o ON o.id=i.order_id ORDER BY i.created_at DESC`)).rows);
  } catch (err) { res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
});

router.post('/', authenticate, async (req, res) => {
  const { invoice_number, order_id, client_id, amount, discount_percent, due_date } = req.body;
  if (!invoice_number || !client_id || !amount) return res.status(400).json({ error: 'Номер, клиент и сумма обязательны' });
  const clientR = await pool.query('SELECT discount_percent FROM clients WHERE id=$1', [client_id]);
  const disc = discount_percent ?? clientR.rows[0]?.discount_percent ?? 0;
  const total = Number(amount) - (Number(amount)*Number(disc)/100);
  const qrData = `stitchflow://pay?invoice=${invoice_number}&amount=${total.toFixed(2)}`;
  try {
    const result = await pool.query(
      `INSERT INTO invoices (invoice_number,order_id,client_id,amount,discount_percent,total_amount,due_date,payment_qr_data,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [invoice_number, order_id||null, client_id, amount, disc, total, due_date||null, qrData, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code==='23505') return res.status(409).json({ error: 'Счёт с таким номером уже существует' });
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.put('/:id/status', authenticate, async (req, res) => {
  const { status } = req.body;
  try {
    const result = await pool.query(`UPDATE invoices SET status=$1, paid_at=CASE WHEN $1='paid' THEN now() ELSE paid_at END WHERE id=$2 RETURNING *`, [status, req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Счёт не найден' });
    if (status==='paid') {
      const inv = result.rows[0];
      notifySubscribers('payment_received', `💰 <b>Оплата получена</b>\nСчёт №${inv.invoice_number}\n₽${Number(inv.total_amount).toLocaleString()}`, {}).catch(()=>{});
    }
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
});

router.get('/:id/pdf', authenticate, async (req, res) => {
  try {
    const invR = await pool.query('SELECT * FROM invoices WHERE id=$1', [req.params.id]);
    const inv = invR.rows[0];
    if (!inv) return res.status(404).json({ error: 'Счёт не найден' });
    const [clientR, companyR, orderR] = await Promise.all([
      pool.query('SELECT * FROM clients WHERE id=$1', [inv.client_id]),
      pool.query('SELECT * FROM company_profile LIMIT 1'),
      inv.order_id ? pool.query('SELECT * FROM orders WHERE id=$1', [inv.order_id]) : Promise.resolve({rows:[]}),
    ]);
    const pdf = await generateInvoicePdf(inv, clientR.rows[0], companyR.rows[0], orderR.rows[0]||null);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="invoice-${inv.invoice_number}.pdf"`);
    res.send(pdf);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
});

module.exports = router;
