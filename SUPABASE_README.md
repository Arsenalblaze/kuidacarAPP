# Supabase Setup

Este projeto usa Supabase como backend principal. As Edge Functions estão implementadas em `supabase/functions/server/index.tsx`.

## Configuração Inicial

1. Instale o Supabase CLI:
```bash
npm install -g supabase
```

2. Faça login no Supabase:
```bash
supabase login
```

3. Link o projeto ao seu projeto Supabase:
```bash
supabase link --project-ref befxsozetzwgouurhduy
```

## Desenvolvimento Local

Para desenvolver com Supabase local:

```bash
# Iniciar Supabase local
npm run supabase:start

# Servir as Edge Functions localmente
npm run supabase:serve

# Ver logs das funções
npm run supabase:logs
```

## Deploy para Produção

Para fazer deploy das Edge Functions:

```bash
# Deploy das funções
npm run supabase:deploy
```

## URLs da API

- **Produção**: `https://befxsozetzwgouurhduy.supabase.co/functions/v1/make-server-9dc5328a`
- **Desenvolvimento Local**: `http://localhost:54321/functions/v1/make-server-9dc5328a`

## Funcionalidades Implementadas

- ✅ Autenticação de usuários (registro/login)
- ✅ Criação de solicitações de serviço
- ✅ Aceitação/cancelamento de serviços por prestadores
- ✅ Rastreamento em tempo real
- ✅ Persistência completa com KV Store

## Teste das Funcionalidades

Use o aplicativo web ou mobile para testar todas as funcionalidades. O backend agora persiste todos os dados no Supabase real.