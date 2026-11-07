const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://befxsozetzwgouurhduy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJlZnhzb3pldHp3Z291dXJoZHV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzOTQ1OTEsImV4cCI6MjA4OTk3MDU5MX0.FtTiIXKO-AS1Bm93aIpan0pbOfSWCLpW1sZ0ri36sgM'
);

async function testConnection() {
  try {
    console.log('🔍 Testando conexão com Supabase...');
    const { data, error } = await supabase.from('profiles').select('count').limit(1);
    if (error && !error.message.includes('relation "profiles" does not exist')) {
      console.error('❌ Erro:', error.message);
      return false;
    }
    console.log('✅ Conexão OK!');
    console.log('📊 Dados retornados:', data);
    return true;
  } catch (err) {
    console.error('❌ Erro de conexão:', err.message);
    return false;
  }
}

testConnection();