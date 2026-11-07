const fetch = require('node-fetch');

async function testEdgeFunction() {
  console.log('🔍 Testando conectividade com Edge Function...');

  try {
    const response = await fetch('https://befxsozetzwgouurhduy.supabase.co/functions/v1/make-server-9dc5328a/health', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJlZnhzb3pldHp3Z291dXJoZHV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzOTQ1OTEsImV4cCI6MjA4OTk3MDU5MX0.FtTiIXKO-AS1Bm93aIpan0pbOfSWCLpW1sZ0ri36sgM'
      }
    });

    console.log('📊 Status Code:', response.status);
    console.log('📄 Headers:', Object.fromEntries(response.headers.entries()));

    const text = await response.text();
    console.log('📄 Response Body:', text);

    if (response.ok) {
      console.log('✅ Edge Function está acessível!');
    } else {
      console.log('❌ Edge Function retornou erro');
    }

  } catch (error) {
    console.log('❌ Erro de conectividade:', error.message);
    console.log('🔍 Detalhes do erro:', error);
  }
}

testEdgeFunction();