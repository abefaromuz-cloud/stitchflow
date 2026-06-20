const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

const EXPENSE_CATEGORY_LABELS = {
  rent: 'Аренда',
  utilities: 'Коммунальные услуги',
  materials: 'Материалы',
  salary: 'Зарплата',
  tax: 'Налоги',
  equipment: 'Оборудование',
  other: 'Прочее'
};

// GET /api/finance/summary - доходы/расходы/прибыль за последние 12 месяцев
router.get('/summary', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM monthly_finance_summary ORDER BY period');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// GET /api/finance/overview - текущий месяц: доходы, расходы, прибыль, долги клиентов, выплаты сотрудникам, налоги
router.get('/overview', authenticate, async (req, res) => {
  try {
    const [revenue, expensesTotal, expensesByCategory, clientDebts, payouts, taxes] = await Promise.all([
      pool.query(`
        SELECT COALESCE(SUM(total_amount), 0) AS revenue
        FROM orders
        WHERE date_trunc('month', created_at) = date_trunc('month', CURRENT_DATE)
      `),
      pool.query(`
        SELECT COALESCE(SUM(amount), 0) AS total
        FROM expenses
        WHERE date_trunc('month', expense_date) = date_trunc('month', CURRENT_DATE)
      `),
      pool.query(`
        SELECT category, COALESCE(SUM(amount), 0) AS total
        FROM expenses
        WHERE date_trunc('month', expense_date) = date_trunc('month', CURRENT_DATE)
        GROUP BY category
      `),
      pool.query(`SELECT COALESCE(SUM(debt_amount), 0) AS total FROM clients`),
      pool.query(`
        SELECT COALESCE(SUM(total_amount), 0) AS total
        FROM salary_records
        WHERE period_month = EXTRACT(MONTH FROM CURRENT_DATE)
          AND period_year = EXTRACT(YEAR FROM CURRENT_DATE)
      `),
      pool.query(`
        SELECT COALESCE(SUM(amount), 0) AS total
        FROM expenses
        WHERE category = 'tax' AND date_trunc('month', expense_date) = date_trunc('month', CURRENT_DATE)
      `)
    ]);

    const rev = Number(revenue.rows[0].revenue);
    const exp = Number(expensesTotal.rows[0].total);

    res.json({
      revenue: rev,
      expenses: exp,
      profit: rev - exp,
      client_debts: Number(clientDebts.rows[0].total),
      employee_payouts: Number(payouts.rows[0].total),
      taxes: Number(taxes.rows[0].total),
      expenses_by_category: expensesByCategory.rows.map(r => ({
        category: r.category,
        label: EXPENSE_CATEGORY_LABELS[r.category] || r.category,
        total: Number(r.total)
      }))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// GET /api/finance/expenses - список расходов
router.get('/expenses', authenticate, async (req, res) => {
  const { month, year } = req.query;
  try {
    let query = 'SELECT * FROM expenses WHERE 1=1';
    const params = [];
    if (month && year) {
      params.push(month, year);
      query += ` AND EXTRACT(MONTH FROM expense_date) = $1 AND EXTRACT(YEAR FROM expense_date) = $2`;
    }
    query += ' ORDER BY expense_date DESC';

    const result = await pool.query(query, params);
    res.json(result.rows.map(r => ({ ...r, category_label: EXPENSE_CATEGORY_LABELS[r.category] || r.category })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// POST /api/finance/expenses - добавить расход
router.post(
  '/expenses',
  authenticate,
  requireRole('admin', 'manager'),
  [
    body('category').isIn(Object.keys(EXPENSE_CATEGORY_LABELS)).withMessage('Некорректная категория'),
    body('amount').isFloat({ gt: 0 }).withMessage('Сумма должна быть больше 0')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { category, amount, description, expense_date } = req.body;
    try {
      const result = await pool.query(
        `INSERT INTO expenses (category, amount, description, expense_date, created_by)
         VALUES ($1, $2, $3, COALESCE($4, CURRENT_DATE), $5) RETURNING *`,
        [category, amount, description, expense_date, req.user.id]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
  }
);

// DELETE /api/finance/expenses/:id
router.delete('/expenses/:id', authenticate, requireRole('admin', 'manager'), async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM expenses WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Расход не найден' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;
