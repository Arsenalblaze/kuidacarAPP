-- Adiciona o campo de dívida ao perfil do prestador
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS debt NUMERIC DEFAULT 0;

