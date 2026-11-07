# 🧪 Guia Completo de Testes - KuidaCar com Supabase

## 📋 Pré-requisitos

✅ **Backend Supabase está conectado e funcionando**  
✅ **Todas as rotas da API estão implementadas**  
✅ **Frontend atualizado para usar API real**

---

## 🎯 PASSO 1: Verificar Conexão com Supabase

### 1.1 Testar Health Check
Abra o Console do navegador (F12) e execute:


`javascript
fetch('https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-9dc5328a/health')
  .then(res => res.json())
  .then(data => console.log('✅ Servidor respondendo:', data))
  .catch(err => console.error('❌ Erro:', err));
```

**Resultado esperado:** `{status: "ok"}`

---

## 🎯 PASSO 2: Teste de Registro - Cliente

### 2.1 Criar Primeiro Cliente

**Persona:** Maria Santos - Motorista que precisa de ajuda

1. Acesse a página inicial do **KuidaCar**
2. Clique em **"Criar Conta"**
3. Selecione **"Cliente"**
4. Preencha os dados:
   - **Nome:** Maria Santos
   - **Email:** maria.santos@example.com
   - **Telefone:** +244 923 111 222
   - **Senha:** teste123
5. Clique em **"Criar Conta"**

### 2.2 Verificar no Console

O registro deve:
- Criar usuário no Supabase Auth
- Salvar perfil no KV Store
- Fazer login automático
- Redirecionar para página de solicitação

### 2.3 Verificar Dados no Supabase Dashboard

1. Acesse: https://supabase.com/dashboard
2. Vá em **Authentication** > **Users**
3. Veja o novo usuário `maria.santos@example.com`
4. Vá em **Database** > **Table Editor** > **kv_store_9dc5328a**
5. Procure a chave que começa com `user:`

---

## 🎯 PASSO 3: Teste de Registro - Prestador

### 3.1 Criar Primeiro Prestador

**Persona:** Carlos Mendes - Mecânico com serviço de reboque

1. Faça logout (se estiver logado)
2. Clique em **"Cadastrar como Prestador"**
3. Preencha os dados:
   - **Nome:** Carlos Mendes
   - **Email:** carlos.mendes@example.com
   - **Telefone:** +244 912 333 444
   - **Senha:** prestador123
   - **Tipo de Serviço:** Reboque e Mecânica
   - **Modelo do Veículo:** Toyota Hilux 2020
   - **Placa:** LD-45-23-AB
4. Clique em **"Criar Conta"**

### 3.2 Verificar Dados Específicos do Prestador

No console, verifique:
```javascript
// Ver dados do usuário atual
console.log('Usuário logado:', JSON.parse(localStorage.getItem('accessToken')));
```

O prestador deve ter:
- `role: "provider"`
- `providerType: "Reboque e Mecânica"`
- `rating: 0`
- `completedServices: 0`
- `isOnline: false`

---

## 🎯 PASSO 4: Teste de Login

### 4.1 Testar Login de Cliente

1. Faça logout
2. Clique em **"Entrar"**
3. Selecione **"Cliente"**
4. Use:
   - Email: maria.santos@example.com
   - Senha: teste123
5. Clique em **"Entrar"**

### 4.2 Verificar Persistência de Sessão

1. Após login bem-sucedido
2. Recarregue a página (F5)
3. **Esperado:** Você deve continuar logado automaticamente

### 4.3 Testar Login de Prestador

Repita os passos acima com:
- Email: carlos.mendes@example.com
- Senha: prestador123

---

## 🎯 PASSO 5: Teste de Solicitação de Serviço

### 5.1 Criar Solicitação (como Cliente)

1. Faça login como **Maria Santos**
2. Na página inicial, clique em **"Solicitar Serviço"**
3. Escolha o tipo: **"Reparo de Pneu"**
4. Adicione descrição: "Pneu furado na Marginal de Luanda"
5. Clique em **"Solicitar Serviço"**

### 5.2 Verificar no Console

```javascript
// Ver solicitações criadas
fetch('https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-9dc5328a/service/pending/all', {
  headers: {
    'Authorization': 'Bearer YOUR_PUBLIC_ANON_KEY'
  }
})
.then(res => res.json())
.then(data => console.log('📋 Solicitações pendentes:', data.services));
```

### 5.3 Verificar no Supabase Dashboard

1. Vá em **Database** > **kv_store_9dc5328a**
2. Procure chave que começa com `service:req_`
3. Verifique os dados:
   - `status: "pending"`
   - `type: "Reparo de Pneu"`
   - `customerId` deve ser o ID da Maria

---

## 🎯 PASSO 6: Teste de Aceitar Solicitação (Prestador)

### 6.1 Ver Solicitações Disponíveis

1. Faça login como **Carlos Mendes** (prestador)
2. No painel do prestador, veja as solicitações pendentes
3. Clique em **"Ver Detalhes"** na solicitação da Maria

### 6.2 Aceitar Solicitação

1. Clique em **"Aceitar Solicitação"**
2. Status muda para `"accepted"`
3. Prestador é atribuído ao serviço

### 6.3 Verificar Atualização no Banco

```javascript
// Ver status atualizado
fetch('https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-9dc5328a/service/SERVICE_ID')
.then(res => res.json())
.then(data => console.log('📦 Serviço atualizado:', data.request));
```

Deve mostrar:
- `status: "accepted"`
- `providerId` deve ser o ID do Carlos

---

## 🎯 PASSO 7: Teste de Rastreamento em Tempo Real

### 7.1 Simular Prestador em Movimento

1. Como prestador (Carlos), clique em **"Iniciar Viagem"**
2. Status muda para `"en_route"`
3. Mapa mostra rota do prestador até o cliente

### 7.2 Verificar do Lado do Cliente

1. Abra outra aba do navegador (ou use modo anônimo)
2. Faça login como **Maria Santos**
3. Vá para a tela de rastreamento
4. Veja o prestador se movendo no mapa

### 7.3 Chegar ao Local

1. Como prestador, clique em **"Chegou ao Local"**
2. Status muda para `"arrived"`

---

## 🎯 PASSO 8: Teste de Conclusão de Serviço

### 8.1 Concluir Serviço (Prestador)

1. Como Carlos, clique em **"Concluir Serviço"**
2. Confirme a conclusão
3. Status muda para `"completed"`

### 8.2 Avaliar Serviço (Cliente)

1. Como Maria, veja a solicitação de avaliação
2. Dê 5 estrelas ⭐⭐⭐⭐⭐
3. Adicione comentário: "Serviço excelente! Rápido e eficiente."
4. Clique em **"Enviar Avaliação"**

### 8.3 Verificar Rating do Prestador

```javascript
// Ver perfil atualizado do prestador
fetch('https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-9dc5328a/user/PROVIDER_ID')
.then(res => res.json())
.then(data => console.log('👷 Prestador:', data.user));
```

Deve mostrar:
- `rating: 5`
- `completedServices: 1`

---

## 🎯 PASSO 9: Teste de Histórico

### 9.1 Ver Histórico do Cliente

1. Como Maria, vá para **"Histórico"**
2. Veja o serviço concluído
3. Clique para ver detalhes completos

### 9.2 Ver Histórico do Prestador

1. Como Carlos, vá para **"Histórico"**
2. Veja o serviço realizado
3. Verifique ganhos em Kwanza (Kz)

---

## 🎯 PASSO 10: Teste de Edição de Perfil

### 10.1 Atualizar Dados do Cliente

1. Como Maria, vá para **"Meu Perfil"**
2. Clique em **"Editar Perfil"**
3. Altere o telefone para: +244 923 999 888
4. Clique em **"Salvar Alterações"**

### 10.2 Verificar Atualização no Banco

1. Recarregue a página
2. Os dados devem persistir
3. Verifique no Supabase Dashboard

---

## 🎯 PASSO 11: Teste Multi-Usuário

### 11.1 Criar Múltiplos Usuários

**3 Clientes:**
- João Silva - joao.silva@example.com
- Ana Costa - ana.costa@example.com
- Pedro Santos - pedro.santos@example.com

**3 Prestadores:**
- Lucas Reboque - lucas.reboque@example.com (Reboque)
- Sofia Pneus - sofia.pneus@example.com (Reparo de Pneu)
- António Bateria - antonio.bateria@example.com (Bateria)

### 11.2 Criar Solicitações Simultâneas

1. João solicita "Reboque"
2. Ana solicita "Reparo de Pneu"
3. Pedro solicita "Bateria"

### 11.3 Prestadores Aceitam

1. Lucas aceita solicitação do João
2. Sofia aceita solicitação da Ana
3. António aceita solicitação do Pedro

### 11.4 Verificar Isolamento de Dados

Cada prestador deve ver apenas:
- Suas próprias solicitações aceitas
- Seu próprio histórico
- Suas próprias avaliações

---

## 🎯 PASSO 12: Teste de Status Online/Offline

### 12.1 Alternar Status do Prestador

1. Como prestador, vá para o painel
2. Clique no toggle **"Online/Offline"**
3. Quando offline:
   - Não recebe novas solicitações
   - Não aparece na busca de prestadores próximos

### 12.2 Verificar no Banco

```javascript
// Ver prestadores online
fetch('https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-9dc5328a/provider/nearby', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    location: { lat: -8.8147, lng: 13.2302 },
    serviceType: 'Reboque'
  })
})
.then(res => res.json())
.then(data => console.log('🟢 Prestadores online:', data.providers));
```

---

## 🔍 Comandos Úteis para Debugging

### Ver todos os usuários
```javascript
// No console do Supabase Dashboard > SQL Editor
SELECT * FROM kv_store_9dc5328a WHERE key LIKE 'user:%';
```

### Ver todas as solicitações
```javascript
SELECT * FROM kv_store_9dc5328a WHERE key LIKE 'service:%';
```

### Ver todas as avaliações
```javascript
SELECT * FROM kv_store_9dc5328a WHERE key LIKE 'rating:%';
```

### Limpar todos os dados de teste
```javascript
// ⚠️ CUIDADO: Isso remove TODOS os dados
DELETE FROM kv_store_9dc5328a;
```

### Limpar apenas serviços
```javascript
DELETE FROM kv_store_9dc5328a WHERE key LIKE 'service:%';
```

---

## 📊 Checklist Final de Testes

### Autenticação ✅
- [ ] Registro de cliente funciona
- [ ] Registro de prestador funciona
- [ ] Login funciona
- [ ] Sessão persiste após reload
- [ ] Logout limpa sessão

### Solicitações de Serviço ✅
- [ ] Cliente pode criar solicitação
- [ ] Solicitação é salva no banco
- [ ] Prestador vê solicitações pendentes
- [ ] Prestador pode aceitar solicitação
- [ ] Status é atualizado corretamente

### Rastreamento ✅
- [ ] Mapa exibe localização do cliente
- [ ] Mapa exibe localização do prestador
- [ ] ETA é calculado corretamente
- [ ] Status é atualizado em tempo real

### Conclusão e Avaliação ✅
- [ ] Prestador pode concluir serviço
- [ ] Cliente pode avaliar serviço
- [ ] Rating é calculado corretamente
- [ ] Histórico é atualizado

### Perfil ✅
- [ ] Cliente pode editar perfil
- [ ] Prestador pode editar perfil
- [ ] Dados persistem após edição
- [ ] Avatar é exibido corretamente

### Multi-Usuário ✅
- [ ] Múltiplos usuários podem se registrar
- [ ] Dados são isolados por usuário
- [ ] Solicitações são atribuídas corretamente
- [ ] Histórico mostra apenas dados do usuário

---

## 🐛 Problemas Comuns e Soluções

### Erro: "Token não fornecido"
**Solução:** Faça login novamente. O token expira após algum tempo.

### Erro: "Usuário não encontrado"
**Solução:** Verifique se o registro foi concluído. Vá ao Supabase Dashboard > Authentication.

### Dados não atualizam
**Solução:** Recarregue a página. Se persistir, limpe o cache do navegador.

### Erro de CORS
**Solução:** Verifique se o servidor Supabase está rodando e as configurações de CORS estão corretas.

### Mapa não carrega
**Solução:** Verifique a conexão com a internet e se a biblioteca Leaflet está instalada.

---

## 📈 Próximos Passos

Após validar todos os testes acima:

1. ✅ **Implementar WebSockets** para atualizações em tempo real
2. ✅ **Adicionar notificações push** para novas solicitações
3. ✅ **Integrar sistema de pagamentos** (ex: Stripe, Paystack)
4. ✅ **Implementar chat** entre cliente e prestador
5. ✅ **Adicionar histórico de localização** (trail do prestador)
6. ✅ **Sistema de cupons e promoções**
7. ✅ **Dashboard administrativo** para monitoramento

---

## 🎉 Teste Completo Realizado!

Se todos os testes acima passaram, parabéns! 🎊

O **KuidaCar** está funcionando com:
- ✅ Backend Supabase integrado
- ✅ Autenticação real
- ✅ Persistência de dados
- ✅ Multi-usuário
- ✅ Tempo real (simulado)
- ✅ Sistema de avaliações
- ✅ Histórico completo

**Pronto para produção?** Considere:
- Segurança (HTTPS, validação de dados)
- Performance (caching, otimização)
- Monitoramento (logs, analytics)
- Compliance (GDPR, proteção de dados)
