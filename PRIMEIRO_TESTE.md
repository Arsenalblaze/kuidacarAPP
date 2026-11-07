# 🎯 SEU PRIMEIRO TESTE - Criar Usuário no KuidaCar

## 📱 TESTE 1: Criar um Cliente (5 minutos)

### 🔴 PASSO 1: Abrir o App
1. Abra o navegador (Chrome recomendado)
2. Acesse o link do seu app KuidaCar
3. Você verá a página inicial com o logo laranja

---

### 🔴 PASSO 2: Ir para Cadastro
1. Na página inicial, clique no botão **"Cadastre-se"** ou **"Criar Conta"**
2. Você será redirecionado para a tela de registro

---

### 🔴 PASSO 3: Selecionar "Cliente"
1. Na tela de registro, você verá duas abas:
   - **Cliente** (ícone de carro 🚗)
   - **Prestador** (ícone de ferramenta 🔧)
2. Certifique-se que a aba **"Cliente"** está selecionada (cor laranja)

---

### 🔴 PASSO 4: Preencher os Dados
Digite exatamente estes dados:

```
Nome Completo: Maria Santos
Email: maria@test.com
Telefone: +244 923 111 222
Senha: 123456
Confirmar Senha: 123456
```

**✅ DICA:** Use estes dados exatos para facilitar o teste!

---

### 🔴 PASSO 5: Clicar em "Criar Conta"
1. Após preencher todos os campos, clique no botão laranja **"Criar Conta"**
2. Você verá a mensagem "Cadastrando..."

---

### 🔴 PASSO 6: Observar o Resultado

#### ✅ SE DEU CERTO:
- Aparecerá uma notificação verde: **"✅ Cadastro realizado! Bem-vindo ao KuidaCar!"**
- Você será redirecionado automaticamente para a página de **"Solicitar Serviço"**
- No topo, você verá o nome "Maria Santos"

#### ❌ SE DEU ERRADO:
- Aparecerá uma notificação vermelha com o erro
- **Abra o Console do navegador (F12)** e veja o erro detalhado
- Copie o erro e vamos debugar juntos!

---

### 🔍 PASSO 7: Verificar no Console (Opcional mas Importante!)

1. Pressione **F12** para abrir as DevTools
2. Vá na aba **"Console"**
3. Você deve ver logs como:
   ```
   POST https://...supabase.co/functions/v1/make-server-9dc5328a/auth/register
   Response: {success: true, user: {...}}
   ```

4. Se vir erros em vermelho, **COPIE E ME ENVIE!**

---

### 🔍 PASSO 8: Verificar no Supabase Dashboard

Agora vamos confirmar que os dados foram salvos:

1. **Abra uma nova aba** e vá para: https://supabase.com/dashboard
2. Faça login na sua conta Supabase
3. Selecione seu projeto do **KuidaCar**
4. No menu lateral, clique em **"Authentication"** → **"Users"**
5. **Você deve ver:** `maria@test.com` na lista! ✅

6. Agora clique em **"Database"** → **"Table Editor"** → **`kv_store_9dc5328a`**
7. **Você deve ver:** Uma linha com:
   - **key:** `user:abc123...` (o ID do usuário)
   - **value:** `{...dados da Maria em JSON...}`

---

## 🎉 PARABÉNS! Você criou seu primeiro usuário!

Agora vamos para o próximo teste...

---

## 📱 TESTE 2: Criar um Prestador (5 minutos)

### 🔴 PASSO 1: Fazer Logout
1. No app, clique no avatar/nome no topo direito
2. Clique em **"Sair"** ou **"Logout"**
3. Você voltará para a página inicial

---

### 🔴 PASSO 2: Ir para Cadastro Novamente
1. Clique em **"Criar Conta"**

---

### 🔴 PASSO 3: Selecionar "Prestador"
1. Desta vez, clique na aba **"Prestador"** (ícone de ferramenta 🔧)
2. A aba ficará laranja quando selecionada

---

### 🔴 PASSO 4: Preencher os Dados do Prestador
Digite exatamente estes dados:

```
Nome Completo: Carlos Mendes
Email: carlos@test.com
Telefone: +244 912 333 444
Tipo de Serviço: Reboque
Modelo do Veículo: Toyota Hilux 2020
Placa do Veículo: LD-123-AB
Senha: 123456
Confirmar Senha: 123456
```

---

### 🔴 PASSO 5: Clicar em "Criar Conta"
1. Clique no botão laranja **"Criar Conta"**

---

### 🔴 PASSO 6: Observar o Resultado

#### ✅ SE DEU CERTO:
- Notificação verde: **"✅ Cadastro realizado! Bem-vindo ao KuidaCar!"**
- Você será redirecionado para o **Painel do Prestador**
- Você verá:
  - Nome: Carlos Mendes
  - Avaliação: ⭐ 0.0
  - Serviços completados: 0
  - Status: Offline

---

### 🔍 PASSO 7: Verificar no Supabase

1. Vá para **Authentication** → **Users**
2. Agora você deve ver **2 usuários:**
   - maria@test.com
   - carlos@test.com

3. Vá para **Database** → **`kv_store_9dc5328a`**
4. Agora você deve ver **2 linhas:**
   - `user:abc123...` (Maria - Cliente)
   - `user:xyz789...` (Carlos - Prestador)

---

## 🎉 EXCELENTE! Agora você tem 2 usuários!

---

## 📱 TESTE 3: Testar Login (3 minutos)

### 🔴 PASSO 1: Fazer Logout
1. Saia da conta do Carlos

---

### 🔴 PASSO 2: Fazer Login como Maria (Cliente)
1. Clique em **"Entrar"**
2. Selecione a aba **"Cliente"**
3. Digite:
   ```
   Email: maria@test.com
   Senha: 123456
   ```
4. Clique em **"Entrar"**

#### ✅ SE DEU CERTO:
- Você entra como Maria Santos
- Vê a página de "Solicitar Serviço"

---

### 🔴 PASSO 3: Fazer Logout e Login como Carlos
1. Faça logout
2. Clique em **"Entrar"**
3. Selecione a aba **"Prestador"**
4. Digite:
   ```
   Email: carlos@test.com
   Senha: 123456
   ```
5. Clique em **"Entrar"**

#### ✅ SE DEU CERTO:
- Você entra como Carlos Mendes
- Vê o Painel do Prestador

---

## 🎉 PERFEITO! Sistema de autenticação funcionando!

---

## 📊 Resumo do que você testou:

✅ Criar conta de Cliente  
✅ Criar conta de Prestador  
✅ Dados salvos no Supabase Auth  
✅ Dados salvos no Supabase Database (KV Store)  
✅ Login de Cliente  
✅ Login de Prestador  
✅ Logout  

---

## 🚀 PRÓXIMOS TESTES

Agora que você tem 2 usuários criados, você pode testar:

### 📝 Teste 4: Solicitar Serviço (Como Cliente)
1. Login como Maria
2. Clique em "Solicitar Serviço"
3. Escolha "Reboque"
4. Adicione descrição
5. Clique em "Solicitar"

### 🛠️ Teste 5: Aceitar Solicitação (Como Prestador)
1. Login como Carlos
2. Veja as solicitações pendentes
3. Aceite a solicitação da Maria

### ⭐ Teste 6: Concluir e Avaliar
1. Carlos conclui o serviço
2. Maria avalia com 5 estrelas
3. Rating do Carlos atualiza

---

## 🐛 PROBLEMAS COMUNS

### ❌ Erro: "Email já existe"
**Solução:** Use outro email. Ex: maria2@test.com

### ❌ Erro: "Cannot read property..."
**Solução:** 
1. Abra F12 → Console
2. Veja o erro completo
3. Me envie o erro

### ❌ Erro: "Failed to fetch"
**Solução:**
1. Verifique sua conexão com internet
2. Verifique se o Supabase está online
3. Vá para: https://status.supabase.com

### ❌ Erro: "Token não fornecido"
**Solução:**
1. Limpe o cache: `localStorage.clear()`
2. Recarregue a página (Ctrl+Shift+R)

### ❌ Tela branca
**Solução:**
1. Abra F12 → Console
2. Veja os erros em vermelho
3. Recarregue a página

---

## 📱 ATALHOS ÚTEIS

### Limpar todos os dados e começar do zero:
```javascript
// Cole no Console (F12)
localStorage.clear();
sessionStorage.clear();
location.reload();
```

### Ver dados do usuário logado:
```javascript
// Cole no Console (F12)
console.log('Token:', localStorage.getItem('accessToken'));
```

### Testar conexão com servidor:
```javascript
// Cole no Console (F12)
fetch('https://SEU_PROJECT_ID.supabase.co/functions/v1/make-server-9dc5328a/health')
  .then(res => res.json())
  .then(data => console.log('✅ Servidor:', data))
  .catch(err => console.error('❌ Erro:', err));
```

---

## ✅ CHECKLIST DE SUCESSO

Marque conforme você completa:

- [ ] Abri o app no navegador
- [ ] Criei conta de Cliente (Maria)
- [ ] Vi a notificação de sucesso
- [ ] Verifiquei no Supabase Auth
- [ ] Verifiquei na tabela KV Store
- [ ] Criei conta de Prestador (Carlos)
- [ ] Fiz login como Maria
- [ ] Fiz login como Carlos
- [ ] Testei logout

---

## 🎉 SE TUDO FUNCIONOU ATÉ AQUI...

**PARABÉNS!** 🎊

Você tem:
- ✅ Backend Supabase integrado e funcionando
- ✅ Autenticação real
- ✅ Dados persistindo no banco
- ✅ Sistema multi-usuário
- ✅ Login/logout funcionando

**Você está pronto para testar o fluxo completo de solicitação de serviço!**

---

## 🆘 PRECISA DE AJUDA?

Se algo não funcionou:

1. **Abra o Console (F12)**
2. **Copie TODO o erro**
3. **Tire um screenshot da tela**
4. **Me envie para análise**

Vou te ajudar a resolver! 🚀

---

**Boa sorte com os testes!** 🎉
