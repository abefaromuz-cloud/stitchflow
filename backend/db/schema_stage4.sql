-- StitchFlow: схема базы данных (Этап 4)
-- Мотивационная система баллов
-- Применяется после schema.sql, schema_stage2.sql, schema_stage3.sql

-- ========================
-- НАСТРОЙКИ СИСТЕМЫ БАЛЛОВ
-- ========================

-- Конфигурация системы: сколько баллов за что начисляется
-- Хранится как одна строка (singleton), обновляется через API
CREATE TABLE bonus_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- Скорость (выработка)
    points_per_unit NUMERIC(6,2) NOT NULL DEFAULT 1,      -- баллов за каждое изделие
    speed_bonus_threshold INTEGER NOT NULL DEFAULT 500,    -- порог для бонуса скорости (шт/мес)
    speed_bonus_points INTEGER NOT NULL DEFAULT 50,        -- дополнительных баллов если >= порога

    -- Качество (% брака)
    zero_defect_points INTEGER NOT NULL DEFAULT 100,       -- баллов за нулевой брак
    low_defect_max_percent NUMERIC(5,2) NOT NULL DEFAULT 1.0, -- макс % брака для "хорошего" качества
    low_defect_points INTEGER NOT NULL DEFAULT 50,         -- баллов если брак <= порога

    -- Посещаемость
    full_attendance_points INTEGER NOT NULL DEFAULT 80,    -- баллов за 0 опозданий и 0 прогулов
    late_penalty_points INTEGER NOT NULL DEFAULT 10,       -- штраф за каждое опоздание
    absent_penalty_points INTEGER NOT NULL DEFAULT 20,     -- штраф за каждый прогул

    -- Пороги премий (баллы → сумма премии в сумах)
    tier1_threshold INTEGER NOT NULL DEFAULT 200,
    tier1_bonus NUMERIC(12,2) NOT NULL DEFAULT 100000,
    tier2_threshold INTEGER NOT NULL DEFAULT 350,
    tier2_bonus NUMERIC(12,2) NOT NULL DEFAULT 250000,
    tier3_threshold INTEGER NOT NULL DEFAULT 500,
    tier3_bonus NUMERIC(12,2) NOT NULL DEFAULT 500000,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================
-- НАЧИСЛЕНИЕ БАЛЛОВ (за месяц)
-- ========================
CREATE TABLE employee_points (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
    period_year INTEGER NOT NULL,

    -- Баллы по категориям
    speed_points INTEGER NOT NULL DEFAULT 0,
    quality_points INTEGER NOT NULL DEFAULT 0,
    attendance_points INTEGER NOT NULL DEFAULT 0,
    total_points INTEGER GENERATED ALWAYS AS (speed_points + quality_points + attendance_points) STORED,

    -- Входные данные (для прозрачности)
    units_produced INTEGER NOT NULL DEFAULT 0,
    defect_count INTEGER NOT NULL DEFAULT 0,
    defect_rate_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
    present_days INTEGER NOT NULL DEFAULT 0,
    late_days INTEGER NOT NULL DEFAULT 0,
    absent_days INTEGER NOT NULL DEFAULT 0,

    -- Результирующая премия
    bonus_tier INTEGER NOT NULL DEFAULT 0,      -- 0=нет, 1/2/3=уровень
    bonus_amount NUMERIC(12,2) NOT NULL DEFAULT 0,

    calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(employee_id, period_month, period_year)
);

CREATE INDEX idx_employee_points_period ON employee_points(period_month, period_year);
CREATE INDEX idx_employee_points_employee ON employee_points(employee_id);

-- ========================
-- ИСТОРИЯ ИСПОЛЬЗОВАНИЯ БАЛЛОВ
-- ========================
CREATE TABLE points_redemptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    period_month INTEGER NOT NULL,
    period_year INTEGER NOT NULL,
    redemption_type VARCHAR(30) NOT NULL, -- cash_bonus, day_off, gift
    description VARCHAR(255),
    points_used INTEGER NOT NULL DEFAULT 0,
    value_amount NUMERIC(12,2),           -- если cash_bonus, то сумма
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Стандартный конфиг по умолчанию
INSERT INTO bonus_config (
    points_per_unit, speed_bonus_threshold, speed_bonus_points,
    zero_defect_points, low_defect_max_percent, low_defect_points,
    full_attendance_points, late_penalty_points, absent_penalty_points,
    tier1_threshold, tier1_bonus,
    tier2_threshold, tier2_bonus,
    tier3_threshold, tier3_bonus
) VALUES (
    1, 500, 50,
    100, 1.0, 50,
    80, 10, 20,
    200, 100000,
    350, 250000,
    500, 500000
);
