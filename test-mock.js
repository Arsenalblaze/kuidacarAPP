async function testMockServer() {
  const baseUrl = 'http://localhost:54321/functions/v1/make-server-9dc5328a';

  try {
    console.log('🧪 Testando mock server...\n');

    // Teste 1: Ping
    console.log('1️⃣ Testando /debug/ping...');
    const pingResponse = await fetch(`${baseUrl}/debug/ping`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJlZnhzb3pldHp3Z291dXJoZHV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzOTQ1OTEsImV4cCI6MjA4OTk3MDU5MX0.FtTiIXKO-AS1Bm93aIpan0pbOfSWCLpW1sZ0ri36sgM'
      }
    });
    console.log('Status:', pingResponse.status);
    console.log('Response:', await pingResponse.text());
    console.log('');

    // Teste 2: Login
    console.log('2️⃣ Testando /auth/login...');
    const loginResponse = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJlZnhzb3pldHp3Z291dXJoZHV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzOTQ1OTEsImV4cCI6MjA4OTk3MDU5MX0.FtTiIXKO-AS1Bm93aIpan0pbOfSWCLpW1sZ0ri36sgM'
      },
      body: JSON.stringify({
        email: 'cliente@test.com',
        password: '123456'
      })
    });
    console.log('Status:', loginResponse.status);
    const loginData = await loginResponse.text();
    console.log('Response:', loginData);

    if (loginResponse.ok) {
      const parsed = JSON.parse(loginData);
      console.log('✅ Login funcionou!');
      console.log('👤 Usuário:', parsed.user?.name);
      console.log('🔑 Token:', parsed.accessToken?.substring(0, 30) + '...');
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

testMockServer();