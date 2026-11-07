// Service Worker para notificações push
const CACHE_NAME = 'kuida-car-v1';

self.addEventListener('install', (event) => {
  console.log('Service Worker instalado');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker ativado');
  event.waitUntil(clients.claim());
});

// Receber notificações push
self.addEventListener('push', (event) => {
  console.log('Push notification recebida:', event);

  let data = {};

  if (event.data) {
    data = event.data.json();
  }

  const options = {
    body: data.message || 'Nova notificação do KuidaCar',
    icon: '/vite.svg', // Ícone da notificação
    badge: '/vite.svg', // Badge para mobile
    vibrate: [200, 100, 200], // Vibração para mobile
    data: {
      url: data.url || '/', // URL para abrir quando clicar
      requestId: data.requestId
    },
    actions: [
      {
        action: 'view',
        title: 'Ver Detalhes'
      },
      {
        action: 'dismiss',
        title: 'Fechar'
      }
    ],
    requireInteraction: true, // Manter notificação até interação
    silent: false
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'KuidaCar', options)
  );
});

// Lidar com cliques nas notificações
self.addEventListener('notificationclick', (event) => {
  console.log('Notificação clicada:', event);

  event.notification.close();

  const data = event.notification.data;
  let url = data.url || '/';

  // Se for uma notificação de serviço aceito, ir para a página de pedidos
  if (data.requestId) {
    url = `/request?highlight=${data.requestId}`;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Verificar se já existe uma janela aberta
      for (let client of windowClients) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus();
        }
      }

      // Se não existir, abrir nova janela
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// Cache básico para PWA
self.addEventListener('fetch', (event) => {
  // Implementar cache se necessário
  // Por enquanto, apenas passar adiante
  event.respondWith(fetch(event.request));
});