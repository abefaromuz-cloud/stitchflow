-- StitchFlow: схема базы данных (Этап 1)
-- PostgreSQL 14+

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================
-- ПОЛЬЗОВАТЕЛИ / AUTH
-- ========================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    phone VARCHAR(30),
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(30) NOT NULL DEFAULT 'employee', -- admin, manager, employee
    avatar_url VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================
-- КЛИЕНТЫ
-- ========================
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_name VARCHAR(200) NOT NULL,
    contact_person VARCHAR(150),
    phone VARCHAR(30),
    whatsapp VARCHAR(30),
    telegram VARCHAR(60),
    email VARCHAR(150),
    discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
    debt_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================
-- СОТРУДНИКИ
-- ========================
CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    full_name VARCHAR(150) NOT NULL,
    position VARCHAR(100), -- швея, оверлочница, закройщик, упаковщик, контролер ОТК
    phone VARCHAR(30),
    photo_url VARCHAR(255),
    hire_date DATE NOT NULL,
    base_salary NUMERIC(12,2) NOT NULL DEFAULT 0,
    piece_rate NUMERIC(12,2) NOT NULL DEFAULT 0, -- сдельная ставка за единицу
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================
-- ЗАКАЗЫ
-- ========================
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number VARCHAR(30) UNIQUE NOT NULL, -- например 000145
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
    product_name VARCHAR(200) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
    total_amount NUMERIC(14,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    status VARCHAR(30) NOT NULL DEFAULT 'new',
        -- new, in_progress, cutting, sewing, qc, packing, completed
    due_date DATE,
    description TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_client ON orders(client_id);

-- Этапы производства заказа (карта производства)
CREATE TABLE order_stages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    stage_name VARCHAR(50) NOT NULL,
        -- received, cutting, sewing, overlock, ironing, qc, packing, shipped
    stage_order INTEGER NOT NULL, -- порядок этапа
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, in_progress, done
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    completed_by UUID REFERENCES employees(id)
);

CREATE INDEX idx_order_stages_order ON order_stages(order_id);

-- Файлы заказа (эскизы, фото, тех. карты, PDF)
CREATE TABLE order_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    file_type VARCHAR(30) NOT NULL, -- sketch, sample_photo, tech_card, finished_photo, pdf, video
    file_url VARCHAR(255) NOT NULL,
    uploaded_by UUID REFERENCES users(id),
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Участие сотрудников в заказе (для расчета сдельной оплаты и % выполнения)
CREATE TABLE order_employee_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    stage_name VARCHAR(50), -- на каком этапе сделано (опционально)
    quantity_done INTEGER NOT NULL DEFAULT 0,
    quantity_defect INTEGER NOT NULL DEFAULT 0,
    work_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(order_id, employee_id, stage_name, work_date)
);

CREATE INDEX idx_oep_order ON order_employee_progress(order_id);
CREATE INDEX idx_oep_employee ON order_employee_progress(employee_id);

-- ========================
-- ПОСЕЩАЕМОСТЬ
-- ========================
CREATE TABLE attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    work_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL, -- present, late, absent, vacation, sick
    check_in TIME,
    check_out TIME,
    notes VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(employee_id, work_date)
);

CREATE INDEX idx_attendance_employee_date ON attendance(employee_id, work_date);

-- ========================
-- ЗАРПЛАТА
-- ========================
CREATE TABLE salary_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
    period_year INTEGER NOT NULL,
    base_salary NUMERIC(12,2) NOT NULL DEFAULT 0,
    piece_work_amount NUMERIC(12,2) NOT NULL DEFAULT 0, -- сумма по сдельной работе
    bonus_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    penalty_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(12,2) GENERATED ALWAYS AS
        (base_salary + piece_work_amount + bonus_amount - penalty_amount) STORED,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, paid
    paid_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(employee_id, period_month, period_year)
);

-- Бонусы/штрафы — детализация
CREATE TABLE salary_adjustments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    salary_record_id UUID NOT NULL REFERENCES salary_records(id) ON DELETE CASCADE,
    type VARCHAR(10) NOT NULL CHECK (type IN ('bonus','penalty')),
    amount NUMERIC(12,2) NOT NULL,
    reason VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================
-- БРАК (агрегированная статистика, используется для AI/рейтингов)
-- view-таблица собирается из order_employee_progress, но держим
-- материализованную статистику можно через VIEW (см. ниже)
-- ========================

CREATE VIEW employee_production_stats AS
SELECT
    e.id AS employee_id,
    e.full_name,
    COALESCE(SUM(oep.quantity_done), 0) AS total_done,
    COALESCE(SUM(oep.quantity_defect), 0) AS total_defect,
    CASE WHEN COALESCE(SUM(oep.quantity_done), 0) > 0
        THEN ROUND(100.0 * SUM(oep.quantity_defect) / SUM(oep.quantity_done), 2)
        ELSE 0
    END AS defect_rate_percent
FROM employees e
LEFT JOIN order_employee_progress oep ON oep.employee_id = e.id
GROUP BY e.id, e.full_name;

-- ========================
-- TRIGGERS: updated_at
-- ========================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_clients_updated_at BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_employees_updated_at BEFORE UPDATE ON employees
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
