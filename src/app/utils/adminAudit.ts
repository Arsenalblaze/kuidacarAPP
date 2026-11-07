import { supabase } from "./api";

export type AdminAuditEventInput = {
  actorId: string;
  actorName: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  description: string;
  details?: Record<string, unknown>;
};

export async function recordAdminAuditEvent(event: AdminAuditEventInput): Promise<void> {
  const { error } = await supabase.from("admin_audit_logs").insert({
    actor_id: event.actorId,
    actor_name: event.actorName,
    actor_email: event.actorEmail,
    actor_role: event.actorRole,
    action: event.action,
    entity_type: event.entityType,
    entity_id: event.entityId || null,
    description: event.description,
    details: event.details || {},
  });

  if (error) throw error;
}
