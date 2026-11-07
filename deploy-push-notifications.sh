#!/bin/bash

# ========================================================
# Deploy Script: send-push-notification
# ========================================================
# Este script faz o deploy da Edge Function
# e verifica se os secrets VAPID estão configurados
# ========================================================

set -e

echo "=========================================="
echo "📨 Deploy: send-push-notification"
echo "=========================================="
echo ""

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para imprimir com cor
print_step() {
  echo -e "${BLUE}→${NC} $1"
}

print_success() {
  echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
  echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
  echo -e "${RED}✗${NC} $1"
}

# ========================================================
# 1. Verificar Supabase CLI
# ========================================================

print_step "Verificando Supabase CLI..."

if ! command -v supabase &> /dev/null; then
  print_error "Supabase CLI não encontrado"
  echo ""
  echo "Instale com:"
  echo "  npm install -g supabase"
  echo "  ou: brew install supabase/tap/supabase"
  echo ""
  exit 1
fi

print_success "Supabase CLI encontrado"
echo ""

# ========================================================
# 2. Fazer Login (se necessário)
# ========================================================

print_step "Verificando autenticação no Supabase..."

if ! supabase projects list &> /dev/null; then
  print_warning "Não autenticado no Supabase"
  echo ""
  echo "Execute:"
  echo "  supabase login"
  echo ""
  exit 1
fi

print_success "Autenticado no Supabase"
echo ""

# ========================================================
# 3. Verificar se a função existe
# ========================================================

print_step "Verificando estrutura da função..."

if [ ! -f "supabase/functions/send-push-notification/index.ts" ]; then
  print_error "Arquivo não encontrado: supabase/functions/send-push-notification/index.ts"
  exit 1
fi

print_success "Arquivo da função encontrado"
echo ""

# ========================================================
# 4. Deploy
# ========================================================

print_step "Fazendo deploy da Edge Function..."
echo ""

supabase functions deploy send-push-notification

echo ""
print_success "Edge Function deployada com sucesso!"
echo ""

# ========================================================
# 5. Verificar Secrets
# ========================================================

print_step "Verificando variáveis de ambiente..."
echo ""

print_warning "Certificar-se de que os secrets foram adicionados:"
echo ""
echo "  Supabase Dashboard:"
echo "  → Project Settings"
echo "  → Secrets"
echo ""
echo "  Adicione:"
echo "  • VAPID_PUBLIC_KEY: (sua chave pública)"
echo "  • VAPID_PRIVATE_KEY: (sua chave privada)"
echo ""

# ========================================================
# 6. Instruções Finais
# ========================================================

echo "=========================================="
echo "✅ Próximas Etapas"
echo "=========================================="
echo ""

print_step "1. Verificar logs da função (últimos 100 linhas):"
echo "   supabase functions logs send-push-notification -n 100"
echo ""

print_step "2. Testar a função:"
echo "   curl -X POST https://YOUR_PROJECT.functions.supabase.co/send-push-notification \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -H 'Authorization: Bearer YOUR_JWT_TOKEN' \\"
echo "     -d '{\"userId\": \"test-user\", \"title\": \"Teste\", \"message\": \"Funcionando!\"}'"
echo ""

print_step "3. Monitorar função em tempo real:"
echo "   supabase functions logs send-push-notification --tail"
echo ""

print_step "4. Adicionar notificações no código:"
echo "   Ver exemplos em: PUSH_NOTIFICATIONS_GUIDE.md"
echo ""

echo "=========================================="
echo "📚 Documentação"
echo "=========================================="
echo ""
echo "  • supabase/functions/send-push-notification/README.md"
echo "  • PUSH_NOTIFICATIONS_GUIDE.md"
echo "  • setup-push-notifications.sql"
echo ""

echo "=========================================="
echo "✨ Deploy Concluído!"
echo "=========================================="
echo ""
