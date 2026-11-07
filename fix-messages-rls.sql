-- Script para corrigir políticas RLS da tabela messages
-- Execute este script no SQL Editor do Supabase

-- 1. Verificar se RLS está habilitado
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'messages';

-- 2. Habilitar RLS se não estiver habilitado
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- 3. Remover políticas existentes que podem estar conflitantes
DROP POLICY IF EXISTS "Allow all operations for messages" ON messages;

-- 4. Criar nova política permissiva
CREATE POLICY "Allow all operations for messages" ON messages
FOR ALL USING (true);

-- 5. Verificar políticas criadas
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'messages';