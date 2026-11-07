import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';

// Cliente Supabase para acesso direto ao banco de dados
const supabase = createClient(
  `https://${projectId}.supabase.co`,
  publicAnonKey,
  {
    auth: {
      flowType: 'pkce',
      detectSessionInUrl: false,
    },
  }
);

class SupabaseDirectApi {
  // ============================================
  // SERVICE REQUESTS - Acesso direto ao banco
  // ============================================

  async createServiceRequest(requestData: {
    type: string;
    description: string;
    location: { lat: number; lng: number; address: string };
    estimatedPrice: number;
    mechanicName?: string; // Novo campo para o nome do mecânico
    customerId?: string;
    providerId?: string;
  }) {
    try {
      console.log('🔍 Tentando criar solicitação diretamente no Supabase...');

      // Primeiro, verificar se a tabela existe
      const { data: tableExists, error: tableCheckError } = await supabase
        .from('service_requests')
        .select('id')
        .limit(1);

      if (tableCheckError && tableCheckError.code === '42P01') {
        console.log('⚠️ Tabela service_requests não existe, tentando criar...');

        // Tentar criar a tabela usando SQL
        const { error: createTableError } = await supabase.rpc('create_service_requests_table');

        if (createTableError) {
          console.log('❌ Não foi possível criar a tabela automaticamente');
          console.log('📝 SQL para criar a tabela manualmente:');
          console.log(`
CREATE TABLE service_requests (
  id TEXT PRIMARY KEY,
  customer_id TEXT,
  provider_id TEXT,
  mechanic_name TEXT,
  type TEXT NOT NULL,
  description TEXT,
  location JSONB,
  estimated_price INTEGER,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
          `);
          throw new Error('Tabela service_requests não existe. Execute o SQL acima no painel do Supabase.');
        }
      }

      // Gerar ID único para a solicitação
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Inserir dados na tabela
      const { data, error } = await supabase
        .from('service_requests')
        .insert({
          id: requestId,
          customer_id: requestData.customerId || null,
          provider_id: requestData.providerId || null,
          mechanic_name: requestData.mechanicName || null,
          type: requestData.type,
          description: requestData.description,
          location: requestData.location,
          estimated_price: requestData.estimatedPrice,
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Erro ao inserir na tabela:', error);
        throw new Error(`Erro ao salvar solicitação: ${error.message}`);
      }

      console.log('✅ Solicitação criada com sucesso:', requestId);

      return {
        success: true,
        request: {
          id: requestId,
          customerId: data.customer_id,
          providerId: data.provider_id,
          mechanicName: data.mechanic_name,
          type: data.type,
          description: data.description,
          location: data.location,
          estimatedPrice: data.estimated_price,
          status: data.status,
          createdAt: data.created_at,
          updatedAt: data.updated_at
        },
        message: "Solicitação criada com sucesso!"
      };

    } catch (error: any) {
      console.error('❌ Erro na criação da solicitação:', error);
      throw error;
    }
  }

  async getServiceRequest(requestId: string) {
    try {
      const { data, error } = await supabase
        .from('service_requests')
        .select('*')
        .eq('id', requestId)
        .maybeSingle();

      if (error) {
        throw new Error(`Erro ao buscar solicitação: ${error.message}`);
      }

      if (!data) {
        throw new Error('Solicitação não encontrada');
      }

      return {
        success: true,
        request: {
          id: data.id,
          customerId: data.customer_id,
          providerId: data.provider_id,
          mechanicName: data.mechanic_name,
          type: data.type,
          description: data.description,
          location: data.location,
          estimatedPrice: data.estimated_price,
          status: data.status,
          createdAt: data.created_at,
          updatedAt: data.updated_at
        }
      };
    } catch (error: any) {
      console.error('❌ Erro ao buscar solicitação:', error);
      throw error;
    }
  }

  async getAllServiceRequests() {
    try {
      const { data, error } = await supabase
        .from('service_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Erro ao buscar solicitações: ${error.message}`);
      }

      const requests = data.map(item => ({
        id: item.id,
        customerId: item.customer_id,
        providerId: item.provider_id,
        mechanicName: item.mechanic_name,
        type: item.type,
        description: item.description,
        location: item.location,
        estimatedPrice: item.estimated_price,
        status: item.status,
        createdAt: item.created_at,
        updatedAt: item.updated_at
      }));

      return {
        success: true,
        requests
      };
    } catch (error: any) {
      console.error('❌ Erro ao buscar solicitações:', error);
      throw error;
    }
  }

  // ============================================
  // DEBUG METHODS
  // ============================================

  async testConnection() {
    try {
      console.log('🔍 Testando conexão direta com Supabase...');

      const { data, error } = await supabase
        .from('service_requests')
        .select('count')
        .limit(1);

      if (error && error.code === '42P01') {
        console.log('⚠️ Tabela service_requests não existe');
        return { success: false, message: 'Tabela não existe', needsTable: true };
      }

      if (error) {
        console.log('❌ Erro de conexão:', error.message);
        return { success: false, message: error.message };
      }

      console.log('✅ Conexão com Supabase OK');
      return { success: true, message: 'Conectado com sucesso' };
    } catch (error: any) {
      console.log('❌ Erro de conexão:', error.message);
      return { success: false, message: error.message };
    }
  }
}

export const supabaseDirectApi = new SupabaseDirectApi();