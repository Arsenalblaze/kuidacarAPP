# ⚡ Teste Rápido - KuidaCar com Supabase

## 🚀 Como Começar a Testar AGORA

### PASSO 1: Verificar que o Supabase está conectado

Abra o console do navegador (F12) e execute:

```javascript
// Testar se o servidor responde
fetch('https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-9dc5328a/health')
  .then(res => res.json())
  .then(data => console.log('✅ Servidor:', data))
  .catch(err => console.error('❌ Erro:', err));
```

Se retornar `{status: "ok"}`, está funcionando! ✅

---

### PASSO 2: Criar seu primeiro usuário CLIENTE

1. Abra o app KuidaCar
2. Clique em **"Criar Conta"**
3. Selecione **"Cliente"**
4. Preencha:
   ```
   Nome: Maria Santos
   Email: maria@test.com
   Telefone: +244 923 111 222
   Senha: 123456
   ```
5. Clique em **"Criar Conta"**

**O que acontece:**
- ✅ Cria usuário no Supabase Auth
- ✅ Salva perfil no banco de dados
- ✅ Faz login automático
- ✅ Redireciona para a página principal

---

### PASSO 3: Criar um usuário PRESTADOR

1. Faça logout (clique no avatar > Sair)
2. Clique em **"Cadastrar como Prestador"**
3. Preencha:
   ```
   Nome: Carlos Mendes
   Email: carlos@test.com
   Telefone: +244 912 333 444
   Senha: 123456
   Tipo: Reboque e Mecânica
   Veículo: Toyota Hilux
   Placa: LD-123-AB
   ```
4. Clique em **"Criar Conta"**

**O que acontece:**
- ✅ Cria prestador com dados específicos
- ✅ Rating inicial: 0
- ✅ Serviços completados: 0
- ✅ Status: Offline

---

### PASSO 4: Testar Fluxo Completo

#### 4.1 Como CLIENTE (Maria)

1. Faça login como maria@test.com
2. Clique em **"Solicitar Serviço"**
3. Escolha: **"Reboque"**
4. Descrição: "Carro quebrado na Marginal"
5. Clique em **"Solicitar"**

#### 4.2 Como PRESTADOR (Carlos)

1. Faça logout e login como carlos@test.com
2. No painel, veja a solicitação da Maria
3. Clique em **"Aceitar"**
4. Clique em **"Iniciar Viagem"**
5. Acompanhe no mapa
6. Clique em **"Chegou ao Local"**
7. Clique em **"Concluir Serviço"**

#### 4.3 Como CLIENTE (Maria) - Avaliar

1. Faça logout e login como maria@test.com
2. Veja a solicitação de avaliação
3. Dê 5 estrelas ⭐⭐⭐⭐⭐
4. Comente: "Excelente serviço!"
5. Envie a avaliação

---

### PASSO 5: Verificar no Supabase Dashboard

1. Acesse https://supabase.com/dashboard
2. Selecione seu projeto
3. Vá em **Authentication** → **Users**
   - Deve ver maria@test.com e carlos@test.com
4. Vá em **Database** → **Table Editor** → **kv_store_9dc5328a**
   - Veja os dados salvos com prefixos:
     - `user:` (perfis de usuários)
     - `service:` (solicitações)
     - `rating:` (avaliações)

---

## 🔍 Como Verificar se os Dados Estão Salvando

### Ver usuários cadastrados

```javascript
// No console do navegador
fetch('https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-9dc5328a/service/pending/all', {
  headers: { 'Authorization': 'Bearer YOUR_PUBLIC_ANON_KEY' }
})
.then(res => res.json())
.then(data => console.log('Dados:', data));
```

### Ver dados no localStorage

```javascript
// Ver token de autenticação
console.log('Token:', localStorage.getItem('accessToken'));
```

---

## 🎯 Cenários de Teste Rápidos

### Teste 1: Registro e Login (2 min)
✅ Registrar cliente  
✅ Fazer logout  
✅ Fazer login novamente  
✅ Verificar que sessão persiste após reload (F5)  

### Teste 2: Criar Solicitação (3 min)
✅ Cliente cria solicitação de "Reparo de Pneu"  
✅ Verificar que aparece como "Pendente"  
✅ Ir para página de rastreamento  

### Teste 3: Prestador Aceita (3 min)
✅ Login como prestador  
✅ Ver solicitações disponíveis  
✅ Aceitar uma solicitação  
✅ Status muda para "Aceita"  

### Teste 4: Concluir e Avaliar (4 min)
✅ Prestador conclui serviço  
✅ Cliente recebe notificação  
✅ Cliente avalia com 5 estrelas  
✅ Rating do prestador atualiza  

### Teste 5: Histórico (2 min)
✅ Cliente vê histórico de serviços  
✅ Prestador vê serviços realizados  
✅ Valores em Kwanza (Kz) aparecem corretamente  

---

## 🐛 Problemas? Soluções Rápidas

### "Erro ao criar usuário"
→ Email já existe. Use outro email.

### "Token não fornecido"
→ Faça login novamente.

### "Servidor não responde"
→ Verifique se o Supabase está online.

### Dados não aparecem
→ Abra as DevTools (F12) → Console → Veja os erros.

### Tela branca
→ Recarregue a página (Ctrl+Shift+R).

---

## 📱 Teste em Diferentes Dispositivos

### Desktop (Chrome/Firefox)
✅ Interface completa  
✅ Mapa em tela cheia  
✅ Todas as funcionalidades  

### Mobile (Responsivo)
✅ Layout otimizado para tela pequena  
✅ Botões maiores  
✅ Navegação simplificada  

### Teste em modo Mobile do Chrome
1. F12 → Toggle device toolbar
2. Selecione iPhone 12 Pro
3. Teste todas as telas

---

## 📊 Dados de Teste Prontos

### 3 Clientes
```
1. maria@test.com | senha: 123456 | Cliente
2. joao@test.com | senha: 123456 | Cliente  
3. ana@test.com | senha: 123456 | Cliente
```

### 3 Prestadores
```
1. carlos@test.com | senha: 123456 | Reboque
2. sofia@test.com | senha: 123456 | Pneu
3. pedro@test.com | senha: 123456 | Bateria
```

---

## ✅ Checklist Rápido (10 min de teste)

- [ ] 1. Criar conta de cliente
- [ ] 2. Criar conta de prestador  
- [ ] 3. Cliente solicita serviço
- [ ] 4. Prestador aceita
- [ ] 5. Prestador conclui
- [ ] 6. Cliente avalia
- [ ] 7. Ver histórico
- [ ] 8. Editar perfil
- [ ] 9. Fazer logout/login
- [ ] 10. Verificar dados no Supabase

---

## 🎉 Tudo Funcionou?

Se sim, você tem:
- ✅ Backend real com Supabase
- ✅ Autenticação funcionando
- ✅ Dados persistindo no banco
- ✅ Sistema completo end-to-end

**Próximos passos:**
1. Testar com mais usuários
2. Testar cenários de erro
3. Adicionar mais tipos de serviço
4. Integrar pagamentos reais
5. Deploy para produção

---

## 🆘 Precisa de Ajuda?

Erros no console? Envie screenshot!
Dados não salvam? Verifique o Supabase Dashboard!
App não carrega? Limpe o cache do navegador!

**Boa sorte com os testes! 🚀**
