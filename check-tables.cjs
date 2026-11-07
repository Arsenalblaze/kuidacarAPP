const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://befxsozetzwgouurhduy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJlZnhzb3pldHp3Z291dXJoZHV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzOTQ1OTEsImV4cCI6MjA4OTk3MDU5MX0.FtTiIXKO-AS1Bm93aIpan0pbOfSWCLpW1sZ0ri36sgM'
);

async function createTablesDirectly() {
  try {
    console.log('🔧 Criando tabelas diretamente...');

    // Tentar criar tabela profiles
    console.log('📝 Criando tabela profiles...');
    const { error: profilesError } = await supabase
      .from('profiles')
      .insert([{
        id: '00000000-0000-0000-0000-000000000000', // ID dummy para testar
        email: 'test@example.com',
        name: 'Test User',
        role: 'customer'
      }]);

    if (profilesError && profilesError.message.includes('relation "profiles" does not exist')) {
      console.log('❌ Tabela profiles não existe. Você precisa criá-la manualmente no painel do Supabase.');
      console.log('📋 Vá para https://supabase.com/dashboard/project/befxsozetzwgouurhduy/sql');
      console.log('📄 Execute o SQL do arquivo create-essential-tables.sql');
    } else if (profilesError) {
      console.log('⚠️ Erro ao inserir em profiles:', profilesError.message);
    } else {
      console.log('✅ Tabela profiles existe e permite inserção');
    }

    // Testar service_requests
    console.log('📝 Testando tabela service_requests...');
    const { error: requestsError } = await supabase
      .from('service_requests')
      .insert([{
        id: 'test-request-' + Date.now(),
        customer_id: '00000000-0000-0000-0000-000000000000',
        type: 'test',
        description: 'Test request',
        location: { lat: 0, lng: 0, address: 'Test' },
        estimated_price: 100,
        status: 'pending'
      }]);

    if (requestsError) {
      console.log('⚠️ Erro ao inserir em service_requests:', requestsError.message);
    } else {
      console.log('✅ Tabela service_requests existe e permite inserção');
    }

  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }
}

createTablesDirectly();