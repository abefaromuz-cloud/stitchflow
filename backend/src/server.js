require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes        = require('./routes/auth');
const dashboardRoutes   = require('./routes/dashboard');
const clientsRoutes     = require('./routes/clients');
const employeesRoutes   = require('./routes/employees');
const ordersRoutes      = require('./routes/orders');
const attendanceRoutes  = require('./routes/attendance');
const salaryRoutes      = require('./routes/salary');
const materialsRoutes   = require('./routes/materials');
const financeRoutes     = require('./routes/finance');
const invoicesRoutes    = require('./routes/invoices');
const aiRoutes          = require('./routes/ai');
const telegramRoutes    = require('./routes/telegram');
const qrRoutes          = require('./routes/qr');
const pointsRoutes      = require('./routes/points');
const clientPortalRoutes = require('./routes/clientPortal');
const tvRoutes          = require('./routes/tv');

const app = express();

app.use(cors());
app.use(express.json());

// ── API ────────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'StitchFlow API' }));

app.use('/api/auth',          authRoutes);
app.use('/api/dashboard',     dashboardRoutes);
app.use('/api/clients',       clientsRoutes);
app.use('/api/employees',     employeesRoutes);
app.use('/api/orders',        ordersRoutes);
app.use('/api/attendance',    attendanceRoutes);
app.use('/api/salary',        salaryRoutes);
app.use('/api/materials',     materialsRoutes);
app.use('/api/finance',       financeRoutes);
app.use('/api/invoices',      invoicesRoutes);
app.use('/api/ai',            aiRoutes);
app.use('/api/telegram',      telegramRoutes);
app.use('/api/qr',            qrRoutes);
app.use('/api/points',        pointsRoutes);
app.use('/api/client-portal', clientPortalRoutes);
app.use('/api/tv',            tvRoutes);

// ── Static frontend ────────────────────────────────────────────────────────
// Railway builds frontend into frontend/dist via the root "build" script
const DIST = path.join(__dirname, '..', '..', 'frontend', 'dist');
app.use(express.static(DIST));

// SPA fallback — все не-API маршруты отдают index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(DIST, 'index.html'));
});

// ── Error handler ──────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`StitchFlow запущен на порту ${PORT}`);
});
