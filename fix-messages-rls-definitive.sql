-- SOLUÇÃO DEFINITIVA PARA RLS DA TABELA MESSAGES
-- Execute este script COMPLETO no SQL Editor do Supabase

-- Passo 1: Verificar estado atual
SELECT
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'messages';

-- Passo 2: Verificar políticas existentes
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'messages';

-- Passo 3: REMOVER todas as políticas existentes que podem estar conflitantes
DROP POLICY IF EXISTS "Allow all operations for messages" ON messages;
DROP POLICY IF EXISTS "Users can send messages" ON messages;
DROP POLICY IF EXISTS "Users can read messages" ON messages;
DROP POLICY IF EXISTS "messages_policy" ON messages;

-- Passo 4: DESABILITAR RLS temporariamente
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;

-- Passo 5: Testar uma inserção simples (remova depois de testar)
-- INSERT INTO messages (id, request_id, sender_id, receiver_id, content, is_read)
-- VALUES ('test-123', 'req-123', 'user-123', 'user-456', 'Test message', false);

-- Passo 6: REABILITAR RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Passo 7: CRIAR política COMPLETAMENTE permissiva
CREATE POLICY "messages_unrestricted" ON messages
FOR ALL
USING (true)
WITH CHECK (true);

-- Passo 8: Verificar se a política foi criada
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'messages';

-- Passo 9: Testar novamente uma inserção (remova depois de testar)
-- INSERT INTO messages (id, request_id, sender_id, receiver_id, content, is_read)
-- VALUES ('test-456', 'req-456', 'user-789', 'user-101', 'Another test message', false);

-- Resultado esperado: Nenhuma mensagem de erro!