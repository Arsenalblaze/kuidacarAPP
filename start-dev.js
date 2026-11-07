#!/usr/bin/env node

/**
 * Script para iniciar o Mock Server e o Dev Server em paralelo
 * 
 * Uso:
 *   node start-dev.js
 * 
 * Isso vai:
 * 1. Iniciar o mock server na porta 54321
 * 2. Iniciar o Vite dev server na porta 5173
 * 
 * Pressione Ctrl+C para parar ambos
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('🚀 Iniciando ambiente de desenvolvimento...\n');

// Iniciar mock server
console.log('📡 Iniciando Mock Server...');
const mockServer = spawn('node', ['temp-mock-server.js'], {
  cwd: __dirname,
  stdio: 'inherit'
});

// Aguardar 2 segundos para garantir que o mock server iniciou
setTimeout(() => {
  console.log('\n✅ Mock Server iniciado!\n');
  console.log('🎨 Iniciando Vite Dev Server...\n');
  
  // Iniciar dev server
  const devServer = spawn('npm', ['run', 'dev'], {
    cwd: __dirname,
    stdio: 'inherit'
  });

  // Tratar encerramento
  process.on('SIGINT', () => {
    console.log('\n\n⏹️  Encerrando servidores...');
    mockServer.kill('SIGINT');
    devServer.kill('SIGINT');
    process.exit(0);
  });

  // Aguardar finalização
  mockServer.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`❌ Mock Server encerrou com código ${code}`);
      devServer.kill('SIGINT');
      process.exit(code);
    }
  });

  devServer.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`❌ Dev Server encerrou com código ${code}`);
      mockServer.kill('SIGINT');
      process.exit(code);
    }
  });
}, 2000);

// Tratar erros
mockServer.on('error', (err) => {
  console.error('❌ Erro ao iniciar Mock Server:', err);
  process.exit(1);
});
