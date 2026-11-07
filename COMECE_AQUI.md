# 🚀 COMECE AQUI - Primeiro Teste do KuidaCar

## ⚡ Teste Rápido (2 minutos)

### 📍 PASSO 1: Abra o App
Clique no link do seu app KuidaCar no navegador

### 📍 PASSO 2: Criar Conta de Cliente
1. Clique em **"Criar Conta"** ou **"Cadastre-se"**
2. Certifique-se que está na aba **"Cliente"** 🚗
3. Preencha exatamente assim:

```
┌─────────────────────────────────────┐
│ Nome Completo: Maria Santos         │
│ Email: maria@test.com               │
│ Telefone: +244 923 111 222          │
│ Senha: 123456                       │
│ Confirmar Senha: 123456             │
└─────────────────────────────────────┘
```

4. Clique em **"Criar Conta"**

### ✅ O QUE DEVE ACONTECER:
- Notificação verde: **"✅ Cadastro realizado! Bem-vindo ao KuidaCar!"**
- Redirecionamento para a página de "Solicitar Serviço"
- Nome "Maria Santos" aparece no topo

### ❌ SE DEU ERRO:
1. Pressione **F12** (abre DevTools)
2. Vá na aba **"Console"**
3. **Copie todo o erro em vermelho**
4. Me envie para análise

---

## 🔍 Verificar se Salvou no Banco

### Opção 1: Verificar no Supabase Dashboard (Recomendado)

1. Abra: https://supabase.com/dashboard
2. Login na sua conta
3. Selecione o projeto **KuidaCar**
4. Vá em **Authentication** → **Users**
5. **Você deve ver:** `maria@test.com` ✅

6. Vá em **Database** → **Table Editor** → **`kv_store_9dc5328a`**
7. **Você deve ver:** Uma linha com `key: user:...` e os dados da Maria

### Opção 2: Verificar no Console

Cole isso no Console (F12):

```javascript
// Ver token de autenticação
console.log('Token:', localStorage.getItem('accessToken'));

// Se o token existir, está funcionando! ✅
```

---

## 📊 Próximo Teste: Criar Prestador

1. Faça **logout** (clique no avatar → Sair)
2. Clique em **"Criar Conta"**
3. Selecione a aba **"Prestador"** 🔧
4. Preencha:

```
┌─────────────────────────────────────┐
│ Nome Completo: Carlos Mendes        │
│ Email: carlos@test.com              │
│ Telefone: +244 912 333 444          │
│ Tipo de Serviço: Reboque            │
│ Modelo: Toyota Hilux 2020           │
│ Placa: LD-123-AB                    │
│ Senha: 123456                       │
│ Confirmar Senha: 123456             │
└─────────────────────────────────────┘
```

5. Clique em **"Criar Conta"**

### ✅ O QUE DEVE ACONTECER:
- Notificação verde de sucesso
- Redirecionamento para "Painel do Prestador"
- Você vê: Rating 0.0 ⭐, Serviços: 0, Status: Offline

---

## 🎯 Teste de Login

### Testar Login como Cliente:
1. Faça logout
2. Clique em **"Entrar"**
3. Aba **"Cliente"**
4. Email: `maria@test.com`
5. Senha: `123456`
6. Clique em **"Entrar"**

✅ Deve entrar como Maria Santos

### Testar Login como Prestador:
1. Faça logout
2. Clique em **"Entrar"**
3. Aba **"Prestador"**
4. Email: `carlos@test.com`
5. Senha: `123456`
6. Clique em **"Entrar"**

✅ Deve entrar como Carlos Mendes

---

## 📁 Documentação Completa

Criamos 3 guias para você:

1. **PRIMEIRO_TESTE.md** ← Guia detalhado passo a passo (leia este se tiver dúvidas)
2. **TESTE_RAPIDO.md** ← Checklist de 10 minutos
3. **GUIA_DE_TESTES.md** ← Guia completo com todos os cenários

---

## 🐛 Problemas Comuns

### "Email já cadastrado"
➜ Use outro email: maria2@test.com

### "Failed to fetch"
➜ Verifique conexão com internet  
➜ Verifique status do Supabase: https://status.supabase.com

### "Token não fornecido"
➜ Faça login novamente

### Tela branca / Erro estranho
➜ Pressione **Ctrl+Shift+R** (reload forçado)  
➜ Ou limpe o cache:
```javascript
localStorage.clear();
location.reload();
```

---

## 📞 Precisa de Ajuda?

**Ao relatar um erro, me envie:**
1. Screenshot da tela
2. Conteúdo completo do Console (F12 → Console)
3. Qual passo você estava fazendo

---

## ✅ Checklist Rápido

- [ ] Abri o app
- [ ] Criei conta de cliente (maria@test.com)
- [ ] Vi notificação de sucesso
- [ ] Verifiquei no Supabase Dashboard
- [ ] Criei conta de prestador (carlos@test.com)
- [ ] Testei login como cliente
- [ ] Testei login como prestador
- [ ] Fiz logout com sucesso

---

## 🎉 Se Tudo Funcionou...

**PARABÉNS!** Você tem:

✅ Backend Supabase integrado  
✅ Autenticação real funcionando  
✅ Dados persistindo no banco  
✅ Multi-usuário configurado  

**Agora você está pronto para testar o fluxo completo!**

---

## 🚀 Próximos Passos

Depois de criar os 2 usuários, você pode testar:

1. **Solicitar Serviço** (como Maria)
2. **Aceitar Solicitação** (como Carlos)
3. **Rastreamento em Tempo Real** (mapa)
4. **Concluir Serviço** (como Carlos)
5. **Avaliar Serviço** (como Maria)
6. **Ver Histórico** (ambos)

---

**BOA SORTE! 🚀**

Se precisar de ajuda, estou aqui! 😊
