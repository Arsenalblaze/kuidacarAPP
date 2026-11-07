import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (globalThis as any)?.SUPABASE_URL || process?.env?.VITE_SUPABASE_URL || process?.env?.SUPABASE_URL || '';
const supabaseKey = (globalThis as any)?.SUPABASE_ANON_KEY || process?.env?.VITE_SUPABASE_ANON_KEY || process?.env?.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    flowType: 'pkce',
    detectSessionInUrl: false,
  },
});

type KVUser = {
  id: string;
  email?: string;
  name?: string;
  phone?: string;
  role?: string;
  providerType?: string;
  provider_type?: string;
  vehicleModel?: string;
  vehicle_model?: string;
  vehiclePlate?: string;
  vehicle_plate?: string;
  documentType?: string;
  document_type?: string;
  documentUrl?: string;
  document_url?: string;
  is_online?: boolean;
  isOnline?: boolean;
  provider_location?: any;
  providerLocation?: any;
  debt?: number;
  isBlocked?: boolean;
  is_blocked?: boolean;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
  status?: string;
  [key: string]: any;
};

export class UserProfileKVService {
  table = 'kv_store_9dc5328a';

  private keyFor(id: string) {
    return `user:${id}`;
  }

  private normalizeRole(role: string | null | undefined) {
    if (!role) return 'customer';
    if (role === 'client') return 'customer';
    if (role === 'customer') return 'customer';
    return role;
  }

  private parseKvValue(value: any) {
    if (!value) return {};
    if (typeof value === 'string') {
      try { return JSON.parse(value); } catch (error) { return {}; }
    }
    return value;
  }

  private async upsertPermanentProfile(id: string, profile: any) {
    const dbRow: any = {
      id,
      email: profile.email ?? null,
      name: profile.name ?? null,
      phone: profile.phone ?? null,
      role: this.normalizeRole(profile.role ?? profile.user_role ?? null),
      avatar: profile.avatar ?? profile.avatar_url ?? profile.photo_url ?? null,
      provider_type: profile.providerType ?? profile.provider_type ?? null,
      vehicle_model: profile.vehicleModel ?? profile.vehicle_model ?? null,
      vehicle_plate: profile.vehiclePlate ?? profile.vehicle_plate ?? null,
      document_type: profile.documentType ?? profile.document_type ?? null,
      document_url: profile.documentUrl ?? profile.document_url ?? null,
      debt: profile.debt ?? profile.debt_amount ?? null,
      is_blocked: profile.isBlocked ?? profile.is_blocked ?? false,
      created_at: profile.created_at || profile.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('profiles').upsert(dbRow, { onConflict: 'id' });
    if (error) {
      if (error.message?.includes('does not exist') || error.code === '42P01') {
        console.warn('⚠️ Tabela profiles não existe ao salvar perfil permanente:', error.message);
        return false;
      }
      throw error;
    }
    return true;
  }

  private async upsertDynamicProfile(id: string, dynamic: any) {
    const key = this.keyFor(id);
    const { data, error } = await supabase.from(this.table).select('value,is_online,provider_location').eq('key', key).maybeSingle();
    if (error) {
      console.warn('⚠️ Erro ao buscar entry dinâmica para upsert:', error.message);
      return false;
    }

    const currentValue = this.parseKvValue(data?.value || {});
    const mergedValue = {
      ...currentValue,
      ...dynamic,
      id,
      updated_at: new Date().toISOString(),
    };

    const upsertPayload: any = {
      key,
      value: mergedValue,
      is_online: dynamic.is_online ?? dynamic.isOnline ?? data?.is_online ?? currentValue?.is_online ?? currentValue?.isOnline ?? false,
      provider_location: dynamic.provider_location ?? dynamic.providerLocation ?? data?.provider_location ?? currentValue?.provider_location ?? currentValue?.providerLocation ?? null,
      debt: dynamic.debt ?? dynamic.debt_amount ?? currentValue?.debt ?? currentValue?.debt_amount ?? null,
    };

    const { error: upsertError } = await supabase.from(this.table).upsert(upsertPayload);
    if (upsertError) {
      console.error('❌ Erro ao salvar perfil dinâmico no KV store:', upsertError);
      return false;
    }
    return true;
  }

  private async bulkFetchKVForKeys(keys: string[]) {
    if (!keys || keys.length === 0) return {} as Record<string, any>;
    try {
      const { data, error } = await supabase.from(this.table).select('key,value,is_online,provider_location').in('key', keys);
      if (error) throw error;
      const map: Record<string, any> = {};
      (data || []).forEach((row: any) => {
        const value = this.parseKvValue(row.value);
        map[row.key] = {
          ...value,
          is_online: row.is_online ?? value?.is_online ?? value?.isOnline ?? false,
          provider_location: row.provider_location ?? value?.provider_location ?? value?.providerLocation ?? null,
        };
      });
      return map;
    } catch (error) {
      console.warn('⚠️ bulkFetchKVForKeys failed:', error);
      return {};
    }
  }

  async createUserProfile(profile: KVUser) {
    const now = new Date().toISOString();
    const permanentCreated = await this.upsertPermanentProfile(profile.id, {
      ...profile,
      created_at: profile.created_at || profile.createdAt || now,
      updated_at: profile.updated_at || profile.updatedAt || now,
    });

    await this.upsertDynamicProfile(profile.id, {
      ...profile,
      is_online: profile.is_online ?? profile.isOnline ?? false,
      provider_location: profile.provider_location ?? profile.providerLocation ?? null,
      status: (profile as any).status ?? null,
    });

    if (!permanentCreated) {
      console.warn('⚠️ Falha ao salvar perfil permanente, continuando com KV como fonte ativa.');
    }

    return this.getCombinedProfile(profile.id);
  }

  async updateUserProfile(id: string, updates: Partial<KVUser>) {
    const permanentFields = new Set([
      'id', 'email', 'name', 'phone', 'role', 'avatar', 'provider_type', 'providerType', 'vehicle_model', 'vehicleModel', 'vehicle_plate', 'vehiclePlate', 'document_type', 'documentType', 'document_url', 'documentUrl', 'debt', 'created_at', 'createdAt', 'updated_at', 'updatedAt', 'is_blocked', 'isBlocked'
    ]);
    const dynamicFields = new Set(['is_online', 'isOnline', 'current_location', 'currentLocation', 'provider_location', 'providerLocation', 'status', 'notifications']);

    const permanentUpdates: any = {};
    const dynamicUpdates: any = {};

    Object.entries(updates).forEach(([key, value]) => {
      if (permanentFields.has(key)) permanentUpdates[key] = value;
      if (dynamicFields.has(key)) dynamicUpdates[key] = value;
    });

    if (Object.keys(permanentUpdates).length > 0) {
      await this.upsertPermanentProfile(id, permanentUpdates);
    }

    if (Object.keys(dynamicUpdates).length > 0) {
      await this.upsertDynamicProfile(id, dynamicUpdates);
    }

    return this.getCombinedProfile(id);
  }

  async getUserProfile(id: string) {
    return this.getCombinedProfile(id);
  }

  async getUserRole(id: string) {
    const combined = await this.getCombinedProfile(id);
    return combined?.role || null;
  }

  async isAdmin(id: string) {
    const role = await this.getUserRole(id);
    return role === 'admin' || role === 'super_admin';
  }

  async isProvider(id: string) {
    const role = await this.getUserRole(id);
    return role === 'provider';
  }

  async isCustomer(id: string) {
    const role = await this.getUserRole(id);
    return role === 'customer';
  }

  async setOnline(id: string) {
    return this.updateUserProfile(id, { is_online: true });
  }

  async setOffline(id: string) {
    return this.updateUserProfile(id, { is_online: false });
  }

  async updateProviderLocation(id: string, location: any) {
    return this.updateUserProfile(id, { provider_location: location });
  }

  async blockUser(id: string) {
    await this.updateUserProfile(id, { is_blocked: true, isBlocked: true });
    return this.getCombinedProfile(id);
  }

  async unblockUser(id: string) {
    await this.updateUserProfile(id, { is_blocked: false, isBlocked: false });
    return this.getCombinedProfile(id);
  }

  async getCombinedProfile(id: string) {
    try {
      const { data: kvData, error: kvError } = await supabase.from(this.table).select('value,is_online,provider_location').eq('key', this.keyFor(id)).maybeSingle();
      if (kvError) {
        console.warn('⚠️ KV read failed in getCombinedProfile:', kvError.message);
      }

      const kvValue = this.parseKvValue(kvData?.value || {});
      const combined = {
        id,
        ...(kvValue || {}),
        role: this.normalizeRole((kvValue?.role || 'customer') as string),
        is_online: kvData?.is_online ?? kvValue?.is_online ?? kvValue?.isOnline ?? false,
        provider_location: kvData?.provider_location ?? kvValue?.provider_location ?? kvValue?.providerLocation ?? null,
        debt: kvValue?.debt ?? kvValue?.debt_amount ?? null,
      };
      return combined;
    } catch (error) {
      console.error('❌ Erro em getCombinedProfile:', error);
      return null;
    }
  }

  async getAllCombinedUsers() {
    try {
      const { data: kvRows, error } = await supabase.from(this.table).select('key,value,is_online,provider_location');
      if (error) {
        console.warn('⚠️ Falha ao buscar usuários no KV:', error.message);
        return [];
      }

      return (kvRows || []).map((row: any) => {
        const value = this.parseKvValue(row.value || {});
        const id = String(value.id || row.key?.replace(/^user:/, '') || '');
        return {
          ...value,
          id,
          role: this.normalizeRole(value.role || 'customer'),
          is_online: row.is_online ?? value.is_online ?? value.isOnline ?? false,
          provider_location: row.provider_location ?? value.provider_location ?? value.providerLocation ?? null,
        };
      }).filter((item: any) => !!item.id);
    } catch (error) {
      console.error('❌ Erro em getAllCombinedUsers:', error);
      return [];
    }
  }

  async getUsersByRole(role: string) {
    try {
      const normalized = (role || '').toLowerCase();
      const { data: kvRows, error } = await supabase.from(this.table).select('key,value,is_online,provider_location');
      if (error) {
        console.warn('⚠️ Falha ao buscar usuários por role no KV:', error.message);
        return [];
      }

      return (kvRows || [])
        .map((row: any) => {
          const value = this.parseKvValue(row.value || {});
          const id = String(value.id || row.key?.replace(/^user:/, '') || '');
          const userRole = this.normalizeRole(value.role || 'customer');
          if (!id || userRole.toLowerCase() !== normalized.toLowerCase()) return null;
          return {
            ...value,
            id,
            role: userRole,
            is_online: row.is_online ?? value.is_online ?? value.isOnline ?? false,
            provider_location: row.provider_location ?? value.provider_location ?? value.providerLocation ?? null,
          };
        })
        .filter(Boolean);
    } catch (error) {
      console.error('❌ Erro em getUsersByRole:', error);
      return [];
    }
  }

  async getProvidersOnline() {
    const providers = await this.getUsersByRole('provider');
    return (providers || []).filter((p: any) => p.is_online || p.isOnline);
  }

  async getCurrentUserProfile() {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user) return null;
      await this.ensureUserExistsFromAuth(data.user);
      return this.getCombinedProfile(data.user.id);
    } catch (error) {
      console.error('❌ Erro ao buscar perfil do usuário atual:', error);
      return null;
    }
  }

  async ensureUserExistsFromAuth(user: any) {
    if (!user || !user.id) return false;
    const { data: profileData, error: profileError } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (profileError) {
      console.warn('⚠️ Erro ao buscar perfil permanente do auth user:', profileError.message);
    }

    const profileFromAuth: KVUser = {
      id: user.id,
      email: user.email,
      name: user.user_metadata?.name || profileData?.name || '',
      phone: user.user_metadata?.phone || profileData?.phone || '',
      role: this.normalizeRole(user.user_metadata?.role || profileData?.role || 'customer'),
      providerType: user.user_metadata?.providerType || user.user_metadata?.provider_type || profileData?.provider_type || null,
      vehicleModel: user.user_metadata?.vehicleModel || user.user_metadata?.vehicle_model || profileData?.vehicle_model || null,
      vehiclePlate: user.user_metadata?.vehiclePlate || user.user_metadata?.vehicle_plate || profileData?.vehicle_plate || null,
      is_online: user.user_metadata?.is_online ?? profileData?.is_online ?? false,
      provider_location: user.user_metadata?.provider_location || profileData?.provider_location || null,
      created_at: profileData?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_blocked: profileData?.is_blocked ?? false,
      isBlocked: profileData?.is_blocked ?? profileData?.isBlocked ?? false,
    };

    await this.createUserProfile(profileFromAuth);
    return true;
  }

  async migrateAllProfilesFromProfilesTable() {
    try {
      const { data, error } = await supabase.from('profiles').select('*');
      if (error) {
        console.warn('⚠️ Tabela profiles não existe ou erro ao ler:', error.message);
        return { success: false, error };
      }

      let created = 0;
      for (const row of data || []) {
        const key = this.keyFor(row.id);
        const { data: existing, error: existingError } = await supabase.from(this.table).select('key').eq('key', key).maybeSingle();
        if (existingError) {
          console.warn('⚠️ Erro ao verificar KV existente durante migração:', existingError.message);
        }
        if (existing?.key) continue;

        const dynamicRecord = {
          key,
          value: {
            id: row.id,
            email: row.email,
            name: row.name,
            phone: row.phone,
            role: this.normalizeRole(row.role),
            providerType: row.provider_type || null,
            vehicleModel: row.vehicle_model || null,
            vehiclePlate: row.vehicle_plate || null,
            is_online: row.is_online ?? false,
            provider_location: row.provider_location || row.location || null,
            status: row.status || null,
          },
          is_online: row.is_online ?? false,
          provider_location: row.provider_location || row.location || null,
        };

        const { error: kvError } = await supabase.from(this.table).upsert(dynamicRecord);
        if (kvError) {
          console.warn('⚠️ Erro ao migrar registro dinâmico para KV:', kvError.message);
          continue;
        }
        created++;
      }
      return { success: true, created };
    } catch (error) {
      console.error('❌ Erro durante migração de perfis para KV:', error);
      return { success: false, error };
    }
  }
}

export default new UserProfileKVService();
