-- CORREÇÃO IMEDIATA PARA RLS DA TABELA MESSAGES
-- Execute este script no SQL Editor do Supabase

-- 1. Desabilitar RLS temporariamente para diagnóstico
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;

-- 2. Testar inserção (opcional - pode remover depois)
-- INSERT INTO messages (id, request_id, sender_id, receiver_id, content, is_read)
-- VALUES ('test-msg', 'test-request', 'test-sender', 'test-receiver', 'Test message', false);

-- 3. Reabilitar RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- 4. Recriar política permissiva
DROP POLICY IF EXISTS "Allow all operations for messages" ON messages;
CREATE POLICY "Allow all operations for messages" ON messages FOR ALL USING (true);

-- 5. Verificar se funcionou
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'messages';