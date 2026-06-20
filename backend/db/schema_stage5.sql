-- StitchFlow: схема базы данных (Этап 5)
-- Клиентский кабинет: токены доступа для клиентов

CREATE TABLE client_access_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    token VARCHAR(64) UNIQUE NOT NULL,
    label VARCHAR(100),          -- название (например "Ссылка для Алишера")
    is_active BOOLEAN NOT NULL DEFAULT true,
    expires_at TIMESTAMPTZ,      -- NULL = бессрочный
    last_used_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_client_tokens_client ON client_access_tokens(client_id);
CREATE INDEX idx_client_tokens_token ON client_access_tokens(token);
