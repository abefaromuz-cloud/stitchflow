require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Routes
app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'StitchFlow API' }));
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/dashboard',     require('./routes/dashboard'));
app.use('/api/clients',       require('./routes/clients'));
app.use('/api/employees',     require('./routes/employees'));
app.use('/api/orders',        require('./routes/orders'));
app.use('/api/attendance',    require('./routes/attendance'));
app.use('/api/salary',        require('./routes/salary'));
app.use('/api/materials',     require('./routes/materials'));
app.use('/api/finance',       require('./routes/finance'));
app.use('/api/invoices',      require('./routes/invoices'));
app.use('/api/ai',            require('./routes/ai'));
app.use('/api/telegram',      require('./routes/telegram'));
app.use('/api/qr',            require('./routes/qr'));
app.use('/api/points',        require('./routes/points'));
app.use('/api/client-portal', require('./routes/clientPortal'));
app.use('/api/tv',            require('./routes/tv'));
app.use('/api/workshop',      require('./routes/workshop'));

// Serve built frontend
const DIST = path.join(__dirname, '..', '..', 'frontend', 'dist');
app.use(express.static(DIST));
app.get('*', (req, res) => res.sendFile(path.join(DIST, 'index.html')));

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`StitchFlow запущен на порту ${PORT}`));
