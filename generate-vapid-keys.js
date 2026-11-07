#!/usr/bin/env node

// Script Node.js para gerar chaves VAPID corretas usando web-push
// Execute com: node generate-vapid-keys.js

import webpush from 'web-push';

console.log('🔐 Gerando chaves VAPID usando web-push...\n');

// Gerar chaves VAPID usando a biblioteca web-push
const vapidKeys = webpush.generateVAPIDKeys();

console.log('✅ CHAVES VAPID GERADAS COM SUCESSO!\n');
console.log('=====================================');
console.log('VAPID_PUBLIC_KEY:', vapidKeys.publicKey);
console.log('VAPID_PRIVATE_KEY:', vapidKeys.privateKey);
console.log('=====================================\n');

console.log('📋 INSTRUÇÕES DE CONFIGURAÇÃO:');
console.log('');
console.log('1. 🗝️  COPIE A VAPID_PRIVATE_KEY ACIMA');
console.log('2. 🌐 Vá para o Supabase Dashboard');
console.log('3. ⚙️  Settings > Edge Functions');
console.log('4. ➕ Adicione variável de ambiente:');
console.log('   - Nome: VAPID_PRIVATE_KEY');
console.log('   - Valor: [COLE A CHAVE PRIVADA]');
console.log('');
console.log('5. 💻 NO FRONTEND (usePushNotifications.ts):');
console.log('   - Substitua a vapidPublicKey pela chave pública acima');
console.log('');
console.log('6. 🔄 REINICIE O SERVIDOR DE DESENVOLVIMENTO');
console.log('');
console.log('✅ PRONTO! Suas notificações push estarão funcionando corretamente.');
console.log('');
console.log('💡 DICAS:');
console.log('- Guarde estas chaves em local seguro');
console.log('- Nunca compartilhe a chave privada');
console.log('- Use sempre a mesma chave para o mesmo projeto');