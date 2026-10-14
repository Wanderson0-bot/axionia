"""Transactional writes to the PostgreSQL runtime schema."""
from uuid import UUID, uuid4
from psycopg.types.json import Jsonb


def _uuid(value):
    return UUID(str(value)) if value else None


def _is_uuid(value):
    try:
        UUID(str(value))
        return True
    except (ValueError, TypeError):
        return False


def record_audit(db, stamp, action, entity_type, entity_id=None, workspace_id=None, user_id=None, metadata=None):
    db.execute(
        "INSERT INTO audit_logs(id,institution_id,user_id,action,resource_type,resource_id,source_entity_id,metadata,created_at) "
        "VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s)",
        (uuid4(), _uuid(workspace_id), _uuid(user_id), action, entity_type,
         _uuid(entity_id), str(entity_id) if entity_id and not _is_uuid(entity_id) else None,
         Jsonb(metadata or {}), stamp()),
    )


def add_message(db, stamp, execution_id, role, content, user_id=None):
    db.execute(
        "INSERT INTO execution_messages(id,execution_id,user_id,role,content,created_at) VALUES(%s,%s,%s,%s,%s,%s)",
        (uuid4(), _uuid(execution_id), _uuid(user_id), role, content, stamp()),
    )


def replace_steps(db, stamp, execution_id, steps, status='pending'):
    db.execute('DELETE FROM execution_steps WHERE execution_id=%s', (_uuid(execution_id),))
    now = stamp()
    for position, title in enumerate(steps):
        db.execute(
            "INSERT INTO execution_steps(id,execution_id,step_order,name,description,status,created_at,updated_at) "
            "VALUES(%s,%s,%s,%s,%s,%s,%s,%s)",
            (uuid4(), _uuid(execution_id), position, title, None, status, now, now),
        )


def update_steps_status(db, stamp, execution_id, status):
    db.execute('UPDATE execution_steps SET status=%s,updated_at=%s WHERE execution_id=%s',
               (status, stamp(), _uuid(execution_id)))


def add_approval(db, stamp, execution_id, user_id, decision):
    now = stamp()
    db.execute(
        "INSERT INTO execution_approvals(id,execution_id,requested_at,approved_by,approved_at,status,decided_at,decided_by) "
        "VALUES(%s,%s,%s,%s,%s,%s,%s,%s)",
        (uuid4(), _uuid(execution_id), now, _uuid(user_id), now if decision == 'approved' else None,
         decision, now, _uuid(user_id)),
    )


def add_invitation(db, stamp, workspace_id, email, role, invited_by_user_id):
    now = stamp()
    invitation = {'id': str(uuid4()), 'workspace_id': str(workspace_id), 'email': email,
                  'role': role, 'status': 'pending', 'invited_by_user_id': str(invited_by_user_id),
                  'created_at': now, 'updated_at': now}
    db.execute(
        "INSERT INTO invitations(id,institution_id,invited_email,invited_by,role,status,created_at,updated_at) "
        "VALUES(%s,%s,%s,%s,%s,'pending',%s,%s)",
        (UUID(invitation['id']), _uuid(workspace_id), email, _uuid(invited_by_user_id), role, now, now),
    )
    return invitation
