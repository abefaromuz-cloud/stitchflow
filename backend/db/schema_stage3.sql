-- StitchFlow: схема базы данных (Этап 3)
-- Добавляет: Telegram-интеграция, QR-токены для этапов производства
-- Применяется после schema.sql и schema_stage2.sql

-- ========================
-- TELEGRAM
-- ========================

-- Подписки пользователей/сотрудников на уведомления через Telegram
CREATE TABLE telegram_subscribers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id VARCHAR(50) UNIQUE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    full_name VARCHAR(150),
    role VARCHAR(30) NOT NULL DEFAULT 'manager', -- manager, owner, employee
    notify_new_order BOOLEAN NOT NULL DEFAULT true,
    notify_employee_absent BOOLEAN NOT NULL DEFAULT true,
    notify_order_completed BOOLEAN NOT NULL DEFAULT true,
    notify_payment_received BOOLEAN NOT NULL DEFAULT true,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Журнал отправленных уведомлений (для истории / повторной отправки)
CREATE TABLE notification_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(50) NOT NULL,
        -- new_order, employee_absent, order_completed, payment_received
    payload JSONB,
    sent_to_count INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'sent', -- sent, failed, skipped
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notification_log_event ON notification_log(event_type);

-- ========================
-- QR-СИСТЕМА ДЛЯ ЭТАПОВ ПРОИЗВОДСТВА
-- ========================

-- Токены для сканирования этапов заказа (каждый заказ получает уникальный токен,
-- по которому мастер сканирует QR и отмечает этап без авторизации в системе)
CREATE TABLE order_qr_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    token VARCHAR(64) UNIQUE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_qr_tokens_order ON order_qr_tokens(order_id);
CREATE INDEX idx_order_qr_tokens_token ON order_qr_tokens(token);

-- Журнал сканирований QR (для аудита: кто и когда отметил этап)
CREATE TABLE qr_scan_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    stage_name VARCHAR(50) NOT NULL,
    employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    scanned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_qr_scan_log_order ON qr_scan_log(order_id);
