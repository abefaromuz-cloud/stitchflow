# StitchFlow — Этапы 1, 2, 3

CRM/ERP/KPI система для швейного цеха.

**Этап 1:**
- Дашборд (активные/выполненные/просроченные заказы, доход, выплаты, лучший сотрудник, загруженность)
- Заказы (создание, карта производства, прогресс по сотрудникам)
- Клиенты (карточки, контакты, скидки, история заказов)
- Сотрудники (карточки, рейтинг производительности, % брака)
- Посещаемость (отметки по дням, сводка за месяц)
- Зарплата (оклад + сдельная + премии/штрафы, расчет, выплата)

**Этап 2:**
- Склад (ткани, нитки, пуговицы, молнии, фурнитура; поступления/списания; нормы расхода на заказ; автосписание по выработке; уведомления о низком остатке)
- Финансы (доходы/расходы/прибыль по месяцам, расходы по категориям, долги клиентов, выплаты сотрудникам, налоги)
- Счета (создание счета по заказу, скидка клиента, PDF-генерация с QR-кодом оплаты, статусы оплаты)

**Этап 5: ТВ-дашборд и Клиентский кабинет**
- **ТВ-дашборд** (`/tv` или `/api/tv`) — полноэкранный дисплей для телевизора в цеху: план/выполнение дня с прогресс-баром, рейтинг сотрудников, активные этапы производства, просроченные заказы, рекордсмен. Обновляется автоматически каждые 30 сек. Публичный (без авторизации).
- **Клиентский кабинет** (`/client/:token`) — персональная ссылка для каждого клиента: список заказов с прогрессом и картой производства, счета с PDF, история. Без авторизации, по уникальному токену.
- Управление токенами прямо в карточке клиента (создать / скопировать ссылку / отозвать).


- Баллы за скорость (выработка × коэф. + бонус за превышение порога)
- Баллы за качество (0% брака → максимум; брак ≤ порога → половина; выше порога → 0)
- Баллы за посещаемость (без нарушений → максимум; -штраф за каждое опоздание/прогул)
- Три уровня премий (пороги баллов → суммы в сумах) — настраиваются через UI
- Рейтинговая таблица с радар-диаграммой и баром выработки
- Кнопка «Выдать» — фиксирует тип (деньги / выходной / подарок) с историей
- История баллов в карточке каждого сотрудника


- AI-аналитика (статистический прогноз сроков завершения заказа, рейтинг сотрудников по выработке и браку, опоздания/прогулы, узкие места производства)
- Telegram-уведомления (новый заказ, отсутствие сотрудника, завершение заказа, поступление оплаты — журнал отправленных уведомлений)
- QR-система: каждый заказ получает QR-код; мастер сканирует со своего телефона (без авторизации) и отмечает выполнение этапа карты производства

## Технологии
- Backend: Node.js + Express + PostgreSQL
- Frontend: React (Vite) + Tailwind CSS + Recharts
- Auth: JWT
- Деплой: Docker Compose

## Быстрый старт (Docker)

```bash
docker compose up -d --build
```

После запуска контейнеров примените схему БД и тестовые данные:

```bash
docker compose exec backend node src/db/migrate.js
docker compose exec backend node src/db/seed.js
```

Откройте http://localhost:8080

Тестовый вход: `admin@stitchflow.local` / `admin123`

## Локальная разработка без Docker

### Backend
```bash
cd backend
cp .env.example .env
npm install
# создайте БД PostgreSQL "stitchflow" вручную
npm run migrate
npm run seed
npm run dev   # http://localhost:4000
```

### Frontend
```bash
cd frontend
npm install
npm run dev   # http://localhost:5173
```

## Структура проекта

```
stitchflow/
├── backend/
│   ├── db/schema.sql          # схема БД
│   ├── src/
│   │   ├── db/                # подключение, миграции, сиды
│   │   ├── middleware/auth.js # JWT-аутентификация
│   │   ├── routes/            # API: auth, dashboard, orders, clients,
│   │   │                         employees, attendance, salary
│   │   └── server.js
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── api/client.js      # axios + JWT interceptor
│   │   ├── components/        # Layout, StatCard
│   │   └── pages/              # Login, Dashboard, Orders, OrderDetail,
│   │                              Employees, EmployeeDetail, Attendance,
│   │                              Salary, Clients
│   └── Dockerfile
└── docker-compose.yml
```

## API эндпоинты (основные)

- `POST /api/auth/login` — вход
- `GET /api/dashboard` — сводка для дашборда
- `GET/POST /api/clients`, `GET/PUT/DELETE /api/clients/:id`
- `GET/POST /api/employees`, `GET/PUT/DELETE /api/employees/:id`
- `GET/POST /api/orders`, `GET/PUT /api/orders/:id`
- `PUT /api/orders/:id/stages/:stageName` — обновить этап карты производства
- `POST /api/orders/:id/progress` — записать выработку сотрудника
- `GET/POST /api/attendance`, `POST /api/attendance/bulk`, `GET /api/attendance/summary`
- `GET /api/salary`, `POST /api/salary/calculate`, `POST /api/salary/:id/adjustments`, `PUT /api/salary/:id/pay`
- `GET/POST /api/materials`, `GET/PUT/DELETE /api/materials/:id`, `POST /api/materials/:id/movements`, `GET /api/materials/alerts/low-stock`
- `GET /api/orders/:id/materials`, `POST /api/orders/:id/materials`, `POST /api/orders/:id/auto-deduct`
- `GET /api/finance/overview`, `GET /api/finance/summary`, `GET/POST/DELETE /api/finance/expenses`
- `GET/POST /api/invoices`, `PUT /api/invoices/:id/status`, `GET /api/invoices/:id/pdf`

## Что дальше (Этап 3 и далее)

- AI-аналитика (прогноз сроков, выявление лучших/слабых сотрудников)
- Telegram-бот (уведомления о заказах, посещаемости, оплатах)
- QR-система для отметки этапов производства мастерами
- Клиентский кабинет
- Экран цеха (ТВ-дашборд)
- Мотивационная система баллов
