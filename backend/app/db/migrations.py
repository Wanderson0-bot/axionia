"""PostgreSQL runtime schema checks.

Historical SQLite-to-PostgreSQL migration logic lives in backend/scripts.
The API never applies DDL at startup.
"""
RUNTIME_TABLES = (
    'users', 'sessions', 'institutions', 'memberships', 'membership_permissions',
    'permissions', 'invitations', 'subscriptions', 'plans', 'files', 'executions',
    'execution_steps', 'execution_approvals', 'execution_messages',
    'execution_results', 'audit_logs',
)


def validate_runtime_schema(db):
    missing = []
    for name in RUNTIME_TABLES:
        if db.execute('SELECT to_regclass(%s) AS table_name', ('public.' + name,)).fetchone()['table_name'] is None:
            missing.append(name)
    if missing:
        raise RuntimeError('Schema PostgreSQL incompleto; tabelas ausentes: ' + ', '.join(missing))