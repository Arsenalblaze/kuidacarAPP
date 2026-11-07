const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://befxsozetzwgouurhduy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJlZnhzb3pldHp3Z291dXJoZHV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzOTQ1OTEsImV4cCI6MjA4OTk3MDU5MX0.FtTiIXKO-AS1Bm93aIpan0pbOfSWCLpW1sZ0ri36sgM'
);

async function createProfilesTable() {
  try {
    console.log('🔧 Criando tabela profiles...');

    // Primeiro, tentar criar a tabela usando uma inserção que force a criação
    // Isso pode não funcionar, mas vamos tentar
    const { error } = await supabase
      .from('profiles')
      .select('*')
      .limit(1);

    if (error && error.message.includes('relation "profiles" does not exist')) {
      console.log('❌ Tabela profiles não existe.');
      console.log('📋 Você precisa criar a tabela manualmente no painel do Supabase:');
      console.log('   1. Vá para https://supabase.com/dashboard/project/befxsozetzwgouurhduy/sql');
      console.log('   2. Execute o seguinte SQL:');

      const createTableSQL = `
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  avatar TEXT,
  name TEXT,
  phone TEXT,
  role TEXT DEFAULT 'customer',
  provider_type TEXT,
  vehicle_model TEXT,
  vehicle_plate TEXT,
  document_type TEXT,
  document_url TEXT,
  online BOOLEAN DEFAULT false,
  debt NUMERIC DEFAULT 0,
  location JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_profiles_online ON profiles(online);
`;

      console.log(createTableSQL);

      console.log('   3. Também habilite RLS (Row Level Security) para a tabela profiles');
      console.log('   4. Crie as seguintes políticas RLS:');

      const rlsPolicies = `
-- Permitir usuários verem seu próprio perfil
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Permitir usuários atualizarem seu próprio perfil
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Permitir usuários inserirem seu próprio perfil
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Permitir prestadores verem perfis de outros prestadores online
CREATE POLICY "Providers can view other online providers" ON profiles
  FOR SELECT USING (
    role = 'provider' AND
    online = true
  );
`;

      console.log(rlsPolicies);

    } else {
      console.log('✅ Tabela profiles já existe!');
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

createProfilesTable();