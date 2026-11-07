#!/bin/bash

echo "🚀 Fazendo deploy das Edge Functions do Supabase..."

# Verificar se está logado
supabase projects list > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "❌ Você não está logado no Supabase. Execute: supabase login"
    exit 1
fi

# Link do projeto (se não estiver linkado)
supabase link --project-ref befxsozetzwgouurhduy

# Deploy das funções
echo "📦 Fazendo deploy da função make-server-9dc5328a..."
supabase functions deploy make-server-9dc5328a

if [ $? -eq 0 ]; then
    echo "✅ Deploy realizado com sucesso!"
    echo "🌐 URL da API: https://befxsozetzwgouurhduy.supabase.co/functions/v1/make-server-9dc5328a"
else
    echo "❌ Erro no deploy. Verifique os logs acima."
    exit 1
fi