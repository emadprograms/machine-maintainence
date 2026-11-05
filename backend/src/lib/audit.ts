import { v4 as uuid } from 'uuid';
import { execute } from '../database.js';

export type AuditAction =
  | 'login' | 'logout'
  | 'create_equipment' | 'update_equipment' | 'delete_equipment'
  | 'create_breakdown' | 'update_workflow' | 'assign_breakdown'
  | 'create_spare_part' | 'create_user' | 'update_user_role'
  | 'suspend_user' | 'create_company' | 'update_company'
  | 'submit_report';

export interface AuditEntry {
  userId?: string;
  userEmail?: string;
  userRole?: string;
  action: AuditAction;
  entityType?: string;
  entityId?: string | string[];
  details?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}

export function logAction(entry: AuditEntry): void {
  execute(
    `INSERT INTO audit_logs (id, user_id, user_email, user_role, action, entity_type, entity_id, details, ip, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uuid(),
      entry.userId || null,
      entry.userEmail || null,
      entry.userRole || null,
      entry.action,
      entry.entityType || null,
      entry.entityId ? String(entry.entityId) : null,
      entry.details ? JSON.stringify(entry.details) : null,
      entry.ip || null,
      entry.userAgent || null,
    ]
  );
}

export function auditFromReq(
  req: { auth?: { sub: string; email: string; role: string }; ip?: string; headers?: Record<string, unknown> },
  action: AuditAction,
  entityType?: string,
  entityId?: string | string[],
  details?: Record<string, unknown>
): void {
  logAction({
    userId: req.auth?.sub,
    userEmail: req.auth?.email,
    userRole: req.auth?.role,
    action,
    entityType,
    entityId,
    details,
    ip: req.ip,
    userAgent: typeof req.headers?.['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
  });
}
