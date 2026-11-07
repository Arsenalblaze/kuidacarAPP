#!/usr/bin/env node
/*
  Script para criar um usuário `super_admin` no Supabase usando Service Role Key.
  Uso:
    SUPABASE_SERVICE_ROLE_KEY=ey... node scripts/create-super-admin.js antonioantonio@gmail.com 121314

  OBS: Guarde a Service Role Key em local seguro. Este script faz chamadas administrativas.
*/
const fetch = global.fetch || require('node-fetch');
const { createClient } = require('@supabase/supabase-js');

// Projeto (copiado de utils/supabase/info.tsx)
const projectId = 'befxsozetzwgouurhduy';
const SUPABASE_URL = `https://${projectId}.supabase.co`;

async function main() {
  const [, , emailArg, passwordArg] = process.argv;
  const email = emailArg || 'antonioantonio@gmail.com';
  const password = passwordArg || '121314';
  const name = email.split('@')[0];

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    console.error('Erro: defina SUPABASE_SERVICE_ROLE_KEY como variável de ambiente antes de rodar.');
    process.exit(1);
  }

  console.log('Criando usuário admin:', email);

  // Criar usuário via Admin REST (auth v1 admin endpoint)
  const resp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
      user_metadata: { name, role: 'super_admin' },
      email_confirm: true,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    console.error('Falha ao criar usuário no Auth:', resp.status, text);
    process.exit(1);
  }

  const user = await resp.json();
  const userId = user?.id || user?.user?.id;
  if (!userId) {
    console.error('Não foi possível obter id do usuário criado:', JSON.stringify(user));
    process.exit(1);
  }

  console.log('Usuário criado no Auth com id:', userId);

  // Agora upsert em profiles e kv_store usando supabase-js com service role
  const supabase = createClient(SUPABASE_URL, serviceKey, { auth: { persistSession: false } });

  try {
    const profileRow = {
      id: userId,
      email,
      name,
      role: 'super_admin',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error: profErr } = await supabase.from('profiles').upsert(profileRow, { onConflict: 'id' });
    if (profErr) console.warn('Aviso: falha ao upsert profiles:', profErr.message || profErr);
    else console.log('Upsert em `profiles` OK');

    const kvPayload = {
      key: `user:${userId}`,
      value: { id: userId, email, name, role: 'super_admin', created_at: new Date().toISOString() },
    };

    const { error: kvErr } = await supabase.from('kv_store_9dc5328a').upsert(kvPayload);
    if (kvErr) console.warn('Aviso: falha ao upsert kv_store_9dc5328a:', kvErr.message || kvErr);
    else console.log('Upsert em `kv_store_9dc5328a` OK');

    console.log('Super admin criado com sucesso. Faça login em /login com o email e senha informados.');
  } catch (err) {
    console.error('Erro ao finalizar criação do super_admin:', err);
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
