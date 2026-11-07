const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  'https://befxsozetzwgouurhduy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJlZnhzb3pldHp3Z291dXJoZHV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzOTQ1OTEsImV4cCI6MjA4OTk3MDU5MX0.FtTiIXKO-AS1Bm93aIpan0pbOfSWCLpW1sZ0ri36sgM'
);

async function createTables() {
  try {
    console.log('🔧 Criando tabelas essenciais no Supabase...');

    // Ler o arquivo SQL
    const sqlContent = fs.readFileSync('create-essential-tables.sql', 'utf8');

    // Dividir em comandos individuais
    const commands = sqlContent
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));

    console.log(`📋 Encontrados ${commands.length} comandos SQL`);

    // Executar cada comando
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      if (command.trim()) {
        console.log(`⚡ Executando comando ${i + 1}/${commands.length}...`);

        try {
          const { error } = await supabase.rpc('exec_sql', { sql: command + ';' });

          if (error) {
            console.warn(`⚠️  Comando ${i + 1} falhou:`, error.message);
            // Continuar com os próximos comandos
          } else {
            console.log(`✅ Comando ${i + 1} executado`);
          }
        } catch (err) {
          console.warn(`⚠️  Erro no comando ${i + 1}:`, err.message);
        }
      }
    }

    console.log('🎉 Processo de criação de tabelas concluído!');
    console.log('🔍 Testando se as tabelas foram criadas...');

    // Testar se as tabelas existem
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('count')
      .limit(1);

    const { data: requestsData, error: requestsError } = await supabase
      .from('service_requests')
      .select('count')
      .limit(1);

    console.log('📊 Status das tabelas:');
    console.log('  - profiles:', profilesError ? '❌ Não existe' : '✅ OK');
    console.log('  - service_requests:', requestsError ? '❌ Não existe' : '✅ OK');

  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }
}

createTables();