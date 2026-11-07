import { supabaseDirectApi } from './src/app/utils/supabase-direct.js';

async function testSupabaseConnection() {
  console.log('🧪 Testando conexão direta com Supabase...\n');

  try {
    // Test 1: Verificar conexão
    console.log('1️⃣ Testando conexão básica...');
    const connectionTest = await supabaseDirectApi.testConnection();
    console.log('Resultado:', connectionTest);

    if (!connectionTest.success && connectionTest.needsTable) {
      console.log('\n⚠️ Tabela service_requests não existe!');
      console.log('📋 Execute o SQL em create-service-requests-table.sql no painel do Supabase\n');
      return;
    }

    // Test 2: Criar uma solicitação de teste
    console.log('2️⃣ Criando solicitação de teste...');
    const testRequest = {
      type: 'pneus',
      description: 'Teste de conexão - troca de pneu',
      location: {
        lat: -8.8383,
        lng: 13.2344,
        address: 'Av. 4 de Fevereiro, Luanda'
      },
      estimatedPrice: 6000,
      mechanicName: 'João Silva'
    };

    const createResult = await supabaseDirectApi.createServiceRequest(testRequest);
    console.log('✅ Solicitação criada:', createResult.request.id);

    // Test 3: Buscar a solicitação criada
    console.log('3️⃣ Buscando solicitação criada...');
    const getResult = await supabaseDirectApi.getServiceRequest(createResult.request.id);
    console.log('✅ Solicitação encontrada:', getResult.request);

    // Test 4: Listar todas as solicitações
    console.log('4️⃣ Listando todas as solicitações...');
    const listResult = await supabaseDirectApi.getAllServiceRequests();
    console.log(`✅ Total de solicitações: ${listResult.requests.length}`);

    console.log('\n🎉 Todos os testes passaram! Conexão com Supabase funcionando.');

  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
    console.log('\n🔧 Possíveis soluções:');
    console.log('1. Verifique se a tabela service_requests existe');
    console.log('2. Execute o SQL em create-service-requests-table.sql');
    console.log('3. Verifique as chaves API do Supabase');
  }
}

testSupabaseConnection();