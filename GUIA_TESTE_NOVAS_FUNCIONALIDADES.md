# 🧪 Guia Rápido de Testes - Novas Funcionalidades

## ⚡ Teste Express (5 minutos)

### Parte 1: Como Cliente ✅

1. **Abra o app e faça login como cliente**
   ```
   Email: cliente@test.com
   Senha: 123456
   ```

2. **Solicite um serviço**
   - Selecione um tipo de serviço (ex: "Troca de Pneu")
   - Ative localização ou use padrão de Luanda
   - Clique "Solicitar Assistência"

3. **Veja os prestadores online**
   - Você verá uma lista com mecânicos disponíveis
   - Cada um mostra: Nome, Tipo de Serviço, Veículo

4. **✨ NOVO: Clique em um Prestador**
   - **Abre um MODAL bonito com:**
     - ✅ Foto/Avatar do prestador
     - ✅ Nome completo
     - ✅ ⭐ Classificação (ex: 4.8 estrelas)
     - ✅ 📞 Número de telefone
     - ✅ 🔧 Tipo de serviço
     - ✅ 🚗 Modelo e placa do veículo
     - ✅ Total de avaliações (24 reviews)
     - ✅ Abas: "Sobre" e "Avaliações"
     - ✅ Botões: Fechar | Chat | Selecionar

5. **💬 NOVO: Teste o Chat**
   - Clique no botão "Chat" no modal
   - **Abre janela de chat com:**
     - ✅ Histórico de mensagens
     - ✅ Avatares dos participantes
     - ✅ Campo para digitar mensagem
     - ✅ Botão Enviar
   - Digite uma mensagem teste
   - Clique enviar
   - Veja a mensagem aparecer

6. **✅ Selecione o Prestador**
   - Clique em "Selecionar" no modal
   - Modal fecha
   - Prestador aparece selecionado
   - Complete a solicitação

---

### Parte 2: Como Prestador ✅

1. **Abra outra aba/janela do navegador**

2. **Faça login como prestador**
   ```
   Email: prestador@test.com
   Senha: 123456
   ```

3. **Vá para "Painel do Prestador"**

4. **Ative Modo Online**
   - Veja o indicador verde "Online"
   - Clique "Online e pegar GPS"
   - Aguarde a permissão de localização

5. **✨ Veja a Solicitação Chegando**
   - Na aba "Pendentes"
   - Você verá a solicitação do cliente com:
     - ✅ Tipo de serviço
     - ✅ Descrição
     - ✅ Endereço
     - ✅ Tempo decorrido ("há 2 minutos")
     - ✅ Valor estimado
     - ✅ Botões: **RECUSAR | ✓ ACEITAR**

6. **🎯 NOVO: Clique em ACEITAR**
   - ✅ Status muda para "accepted" no BD
   - ✅ Localização GPS é salva
   - ✅ Redirecionado automaticamente para **MAPA DE TRACKING**
   - ✅ Vê:
     - Sua localização (verde)
     - Localização do cliente (laranja)
     - Rota traçada entre vocês
     - Status "A caminho" no topo
     - Timer de chegada estimada

7. **📍 NOVO: Veja Localização em Tempo Real**
   - Sua localização se move em direção ao cliente
   - A cada 3 segundos atualiza
   - Quando chegar perto, muda para "Chegou ao local"

---

## 🧪 Teste Detalhado (15 minutos)

### Cenário 1: Chat Funcional

**Cliente:**
1. Seleciona prestador
2. Abre chat
3. Envia: "Qual é a ETA?"
4. Vê mensagem no chat com timestamp

**Prestador:**
1. Vê o cliente na solicitação
2. Ao aceitar, tem opção de chat
3. Pode responder no chat

**Resultado Esperado:**
- ✅ Ambos veem as mensagens
- ✅ Timestamps são corretos
- ✅ Avatares aparecem
- ✅ Mensagens coloridas diferente para cada um

---

### Cenário 2: Recusar Solicitação

**Prestador:**
1. Vê solicitação pendente
2. Clica em **RECUSAR**
3. Vê toast dizendo "Solicitação recusada"
4. Solicitação desaparece da lista

**Resultado Esperado:**
- ✅ Solicitação some da aba Pendentes
- ✅ Status no BD muda para "recusado"

---

### Cenário 3: Fluxo Completo

**Timeline:**
- 00:00 - Cliente solicita serviço
- 00:05 - Prestador vê solicitação pendente
- 00:10 - Prestador clica ACEITAR
- 00:15 - Prestador é redirecionado para mapa
- 00:20 - Localização atualiza em tempo real
- 00:25 - Prestador chega ao cliente
- 00:30 - Ambos veem "Serviço concluído"

---

## 📱 Elementos Visuais a Verificar

### ProviderProfileModal
```
┌─────────────────────────────┐
│  Perfil do Prestador        │
├─────────────────────────────┤
│  [Avatar]  João da Silva    │
│            Troca de Pneu    │
│            ⭐⭐⭐⭐⭐ 4.8  │
├─────────────────────────────┤
│  📞 +244 923 456 789        │
│  🔧 Troca de Pneu           │
│  🚗 Toyota - ABC-1234       │
│  ⭐ 24 avaliações           │
├─────────────────────────────┤
│  [Sobre] [Avaliações]       │
│  - Verificado               │
│  - Top Avaliado             │
├─────────────────────────────┤
│ [Fechar] [Chat] [Selecionar]│
└─────────────────────────────┘
```

### ChatModal
```
┌─────────────────────────────┐
│  [Avatar] João da Silva     │
├─────────────────────────────┤
│                             │
│          Olá! Estou         │
│          a caminho!         │
│          14:32              │
│                             │
│    Qual é a ETA? →          │
│           14:35             │
│                             │
├─────────────────────────────┤
│ [Digite sua mensagem...] [✈]│
└─────────────────────────────┘
```

---

## 🚨 Problemas Comuns & Soluções

### ❌ Modal não abre ao clicar no prestador
- **Solução:** Verifique console para erros de JavaScript
- Tente atualizar a página

### ❌ Chat não envia mensagens
- **Solução:** Modal é mock, não salva no BD ainda
- Isso é normal para este teste
- As mensagens aparecem localmente

### ❌ Localização não atualiza no mapa
- **Solução:** Verifique se ativou GPS
- GPS pode demorar 5-10s para aparecer
- Simulação funciona mesmo sem GPS

### ❌ Redirecionamento não funciona
- **Solução:** Verifique se aceitou solicitação
- Aguarde 500ms (delay proposital)
- Verifique URL: deve ser `/tracking/[REQUEST_ID]`

---

## ✅ Checklist de Validação

- [ ] Modal abre ao clicar em prestador
- [ ] Modal mostra nome, telefone, especialidade
- [ ] Modal mostra classificação com estrelas
- [ ] Chat modal abre ao clicar em "Chat"
- [ ] Pode digitar e enviar mensagens no chat
- [ ] Mensagens aparecem no histórico
- [ ] Botão Selecionar funciona
- [ ] Prestador vê solicitação pendente
- [ ] Botão Recusar funciona
- [ ] Botão Aceitar funciona
- [ ] Redireciona para mapa após aceitar
- [ ] Mapa mostra rota entre cliente e prestador
- [ ] Localização do prestador atualiza

---

## 🎓 Conceitos Implementados

✅ **Component Props** - Passagem de dados entre componentes
✅ **Modal Dialog** - UI reusável para exibir informações
✅ **State Management** - Gerenciamento de estado React
✅ **Event Handling** - Cliques, envio de formulários
✅ **Async/Await** - Chamadas de API
✅ **Conditional Rendering** - Mostrar/ocultar elementos
✅ **Styling** - Tailwind CSS para design responsivo
✅ **Real-time Updates** - Atualização automática de dados

---

## 📊 Dados de Teste

### Cliente Teste
```
Email: cliente@test.com
Senha: 123456
Nome: Cliente Teste
Telefone: +244 912 345 678
```

### Prestador Teste
```
Email: prestador@test.com
Senha: 123456
Nome: João da Silva
Telefone: +244 923 456 789
Especialidade: Troca de Pneu
Veículo: Toyota Hilux
Placa: ABC-1234
Rating: 4.8 ⭐
Avaliações: 24
```

---

## 🎯 Objetivo Final

Após estes testes, você deve ter validado:
1. ✅ Cliente pode ver perfil completo do prestador
2. ✅ Cliente pode conversar via chat
3. ✅ Cliente pode selecionar prestador
4. ✅ Prestador recebe solicitações
5. ✅ Prestador pode aceitar/recusar
6. ✅ Após aceitar, é redirecionado para mapa
7. ✅ Mapa mostra rota em tempo real

**Se tudo passou: 🎉 Funcionalidades validadas com sucesso!**
