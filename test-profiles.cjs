const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://befxsozetzwgouurhduy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJlZnhzb3pldHp3Z291dXJoZHV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzOTQ1OTEsImV4cCI6MjA4OTk3MDU5MX0.FtTiIXKO-AS1Bm93aIpan0pbOfSWCLpW1sZ0ri36sgM'
);

async function testProfilesTable() {
  try {
    console.log('🔍 Testando tabela profiles...');

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .limit(1);

    if (error) {
      console.error('❌ Erro na tabela profiles:', error.message);
      return false;
    }

    console.log('✅ Tabela profiles OK!');
    console.log('📊 Dados:', data);

    return true;
  } catch (err) {
    console.error('❌ Erro de conexão:', err.message);
    return false;
  }
}

testProfilesTable();