#!/usr/bin/env node

// Script simples para iniciar o mock server
console.log('🚀 Iniciando KuidaCar Mock Server...');
console.log('📡 Este servidor simula a Edge Function do Supabase');
console.log('─'.repeat(60));

// Importar e executar o mock server
import('./temp-mock-server.js')
  .then(() => {
    console.log('✅ Mock server carregado com sucesso!');
  })
  .catch((error) => {
    console.error('❌ Erro ao carregar mock server:', error);
    process.exit(1);
  });