#!/usr/bin/env python3
"""Migrate AXION's SQLite data to PostgreSQL.

Safe default: no mode is implicit. Use --dry-run to inspect, or --apply only
when the dry-run has been reviewed. IDs are UUIDv5 values derived from source
table and source ID, so retries use the same mapping.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import shutil
import sqlite3
import subprocess
import sys
import uuid
from collections import Counter
from pathlib import Path
from urllib.parse import urlsplit
from dotenv import load_dotenv

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


BACKEND = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND / ".env", override=True)

SQLITE_PATH = BACKEND / "data" / "axion.db"
UPLOADS = BACKEND / "uploads"
UUID_NAMESPACE = uuid.UUID("9a8c3600-0749-4ca2-9abc-9cc6c5d83091")
SAFE_PERMISSION_CODES = {
    "create_executions", "create_reports", "manage_members",
    "manage_permissions", "upload_files", "view_attendance",
    "view_executions", "view_grades", "view_reports",
}
SOURCE_TABLES = (
    "users", "workspaces", "memberships", "workspace_members",
    "workspace_invitations", "workspace_plans", "files", "executions",
    "execution_steps", "execution_approvals", "execution_messages", "audit_logs",
)
TARGET_TABLES = (
    "users", "institutions", "legacy_workspaces", "memberships", "permissions",
    "membership_permissions", "invitations", "plans", "subscriptions", "files",
    "executions", "execution_steps", "execution_approvals", "execution_messages",
    "execution_results", "audit_logs", "legacy_records",
)


class MigrationError(RuntimeError):
    pass


def stable_id(kind: str, source_id: str) -> str:
    return str(uuid.uuid5(UUID_NAMESPACE, f"axion-sqlite:{kind}:{source_id}"))


def psql_path() -> str:
    found = shutil.which("psql")
    if found:
        return found
    candidates = [
        Path(r"C:\Program Files\PostgreSQL\18\bin\psql.exe"),
        Path(r"C:\Program Files\PostgreSQL\17\bin\psql.exe"),
        Path("/usr/bin/psql"), Path("/usr/local/bin/psql"),
    ]
    for candidate in candidates:
        if candidate.is_file():
            return str(candidate)
    raise MigrationError("Cliente psql não encontrado; nenhuma migração foi iniciada.")


def safe_error(message: str, database_url: str) -> str:
    message = message.replace(database_url, "[DATABASE_URL ocultada]")
    parsed = urlsplit(database_url)
    if parsed.password:
        message = message.replace(parsed.password, "[segredo ocultado]")
    return re.sub(r"postgres(?:ql)?://[^\s'\"]+", "[DATABASE_URL ocultada]", message)



def run_psql(sql: str, *, read_only: bool = True) -> str:
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise MigrationError("A variável DATABASE_URL não está definida.")

    args = [
        psql_path(),
        database_url,
        "-X",
        "-v", "ON_ERROR_STOP=1",
        "-A", "-t", "-F", "\t",
    ]

    if not read_only:
        args.append("--single-transaction")

    child_env = os.environ.copy()
    child_env["PGCLIENTENCODING"] = "UTF8"
    child_env["PYTHONIOENCODING"] = "utf-8"

    try:
        proc = subprocess.run(
            args,
            input=sql,
            text=True,
            encoding="utf-8",
            errors="replace",
            env=child_env,
            capture_output=True,
            check=False,
        )
    except OSError as exc:
        raise MigrationError(
            f"Não foi possível iniciar psql: {exc}"
        ) from exc

    if proc.returncode:
        details = safe_error(
            (proc.stderr or "").strip()
            or (proc.stdout or "").strip()
            or f"psql terminou com código {proc.returncode}.",
            database_url,
        )

        if not read_only:
            raise MigrationError(
                "PostgreSQL rejeitou a transação; rollback realizado. "
                + details
            )

        raise MigrationError(
            "Consulta PostgreSQL somente leitura falhou. " + details
        )

    return (proc.stdout or "").strip()
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise MigrationError("A variável DATABASE_URL não está definida.")
    args = [psql_path(), database_url, "-X", "-v", "ON_ERROR_STOP=1", "-A", "-t", "-F", "\t"]
    if not read_only:
        args.append("--single-transaction")
    child_env = os.environ.copy()
    child_env["PGCLIENTENCODING"] = "UTF8"
    try:
        proc = subprocess.run(args, input=sql, text=True, encoding="utf-8", env=child_env, capture_output=True, check=False)
    except OSError as exc:
        raise MigrationError(f"Não foi possível iniciar psql: {exc}") from exc
    if proc.returncode:
        details = safe_error(proc.stderr.strip() or proc.stdout.strip(), database_url)
        if not read_only:
            raise MigrationError("PostgreSQL rejeitou a transação; rollback realizado. " + details)
        raise MigrationError("Consulta PostgreSQL somente leitura falhou. " + details)
    return proc.stdout.strip()


def sqlite_connection() -> sqlite3.Connection:
    if not SQLITE_PATH.is_file():
        raise MigrationError(f"SQLite não encontrado: {SQLITE_PATH}")
    uri = SQLITE_PATH.resolve().as_uri() + "?mode=ro"
    db = sqlite3.connect(uri, uri=True)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA query_only = ON")
    return db


def source_rows(db: sqlite3.Connection, table: str) -> list[dict]:
    return [dict(row) for row in db.execute(f'SELECT * FROM "{table}"')]


def json_value(value):
    if value is None:
        return None
    if isinstance(value, (dict, list, int, float, bool)):
        return value
    if isinstance(value, bytes):
        value = value.decode("utf-8", "strict")
    return json.loads(value)


def normalize_json_value(value):
    if isinstance(value, bytes):
        return value.decode("utf-8", "strict")
    if isinstance(value, dict):
        return {normalize_json_value(k): normalize_json_value(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [normalize_json_value(item) for item in value]
    if isinstance(value, str):
        value.encode("utf-8", "strict")
        return value
    if value is None or isinstance(value, (bool, int, float)):
        return value
    raise TypeError(f"Tipo não serializável para JSON/JSONB: {type(value).__name__}")


def validate_utf8_payload(data: dict[str, list[dict]], sql: str) -> tuple[int, list[str]]:
    """Validate SQLite values and the exact UTF-8 SQL payload used by psql."""
    json_fields = {
        "memberships": {"permissions"}, "workspace_members": {"permissions"},
        "workspace_plans": {"limits_json"},
        "executions": {"plan", "questions", "required_inputs", "used_files", "used_tools", "result"},
        "audit_logs": {"metadata"},
    }
    timestamp_fields = {
        "users": {"created_at"}, "workspaces": {"created_at"},
        "workspace_invitations": {"created_at", "updated_at"},
        "workspace_plans": {"created_at", "updated_at"},
        "files": {"created_at"}, "executions": {"created_at", "updated_at", "approved_at"},
        "execution_steps": {"created_at", "updated_at"},
        "execution_approvals": {"created_at"}, "execution_messages": {"created_at"},
        "audit_logs": {"created_at"},
    }
    issues = []
    examined = 0

    def walk(value, table, column, record_id, stage, path="$", seen=None):
        nonlocal examined
        seen = seen or set()
        examined += 1
        if isinstance(value, bytes):
            try:
                value.decode("utf-8", "strict")
            except UnicodeDecodeError as exc:
                issues.append(f"{table}.{column} id={record_id!r} tipo=bytes valor={value[:80]!r} etapa={stage} exceção={type(exc).__name__}: {exc}")
        elif isinstance(value, str):
            try:
                value.encode("utf-8", "strict")
            except UnicodeEncodeError as exc:
                shown = "[redacted]" if column == "password_hash" else ascii(value[:120])
                issues.append(f"{table}.{column} id={record_id!r} tipo=str valor={shown} etapa={stage}{path} exceção={type(exc).__name__}: {exc}")
        elif isinstance(value, dict):
            for key, item in value.items():
                walk(key, table, column, record_id, stage, path + ".<key>", seen)
                walk(item, table, column, record_id, stage, path + "." + str(key), seen)
        elif isinstance(value, (list, tuple)):
            for index, item in enumerate(value):
                walk(item, table, column, record_id, stage, f"{path}[{index}]", seen)
        elif value is not None and not isinstance(value, (bool, int, float)):
            issues.append(f"{table}.{column} id={record_id!r} tipo={type(value).__name__} etapa={stage}{path} exceção=TypeError: tipo não suportado")

    for table, rows in data.items():
        if table == "sessions":
            continue
        for row in rows:
            record_id = row.get("id") or row.get("workspace_id") or "(sem-id)"
            for column, value in row.items():
                walk(value, table, column, record_id, "sqlite->python")
                if value is None:
                    continue
                if column in json_fields.get(table, set()):
                    try:
                        parsed = json_value(value)
                        normalize_json_value(parsed)
                        json.dumps(parsed, ensure_ascii=False, allow_nan=False, separators=(",", ":"))
                    except (ValueError, TypeError, UnicodeDecodeError, UnicodeEncodeError) as exc:
                        shown = "[redacted]" if column == "password_hash" else ascii(str(value)[:120])
                        issues.append(f"{table}.{column} id={record_id!r} tipo={type(value).__name__} valor={shown} etapa=json->jsonb exceção={type(exc).__name__}: {exc}")
                    else:
                        walk(parsed, table, column, record_id, "json->jsonb")
                if column in timestamp_fields.get(table, set()):
                    try:
                        dt.datetime.fromisoformat(str(value).replace("Z", "+00:00"))
                    except (ValueError, TypeError) as exc:
                        issues.append(f"{table}.{column} id={record_id!r} tipo={type(value).__name__} valor={ascii(str(value)[:120])} etapa=timestamp->timestamptz exceção={type(exc).__name__}: {exc}")
    try:
        encoded = sql.encode("utf-8", "strict")
        encoded.decode("utf-8", "strict")
    except (UnicodeEncodeError, UnicodeDecodeError) as exc:
        issues.append(f"postgresql SQL payload tipo=str etapa=python->psql UTF-8 exceção={type(exc).__name__}: {exc}")
    return examined, issues


def source_snapshot(db: sqlite3.Connection) -> dict[str, list[dict]]:
    return {table: source_rows(db, table) for table in SOURCE_TABLES}


def count_sql() -> str:
    selects = " ".join(
        f"SELECT '{table}' AS table_name, count(*) AS n FROM public.{table} UNION ALL"
        for table in TARGET_TABLES
    )
    selects = selects.removesuffix(" UNION ALL")
    return f"BEGIN READ ONLY; SELECT table_name||'='||n FROM ({selects}) q ORDER BY table_name; ROLLBACK;"


def target_counts() -> dict[str, int]:
    output = run_psql(count_sql())
    counts = {}
    for line in output.splitlines():
        if "=" in line:
            name, value = line.split("=", 1)
            counts[name] = int(value)
    missing = set(TARGET_TABLES) - counts.keys()
    if missing:
        raise MigrationError("Tabelas PostgreSQL esperadas ausentes: " + ", ".join(sorted(missing)))
    return counts


def target_values(table: str, column: str) -> set[str]:
    output = run_psql(f"BEGIN READ ONLY; SELECT {column}::text FROM public.{table} ORDER BY 1; ROLLBACK;")
    return {line for line in output.splitlines() if line}


def target_permission_map() -> dict[str, str]:
    output = run_psql("BEGIN READ ONLY; SELECT code||E'\\t'||id::text FROM public.permissions ORDER BY code; ROLLBACK;")
    result = {}
    for line in output.splitlines():
        if "\t" in line:
            code, permission_id = line.split("\t", 1)
            result[code] = permission_id
    return result


def decoded_permissions(row: dict) -> list[str]:
    return list(dict.fromkeys(json_value(row.get("permissions")) or []))


def legacy_record_specs(data: dict[str, list[dict]], institutions: set[str]) -> list[dict]:
    workspace_by_id = {w["id"]: w for w in data["workspaces"]}
    specs = []
    for row in data["memberships"]:
        workspace = workspace_by_id.get(row["workspace_id"])
        codes = decoded_permissions(row)
        if workspace and workspace["type"] == "personal":
            payload = dict(row)
            payload["permissions"] = codes
            specs.append({"legacy_workspace_id": stable_id("legacy_workspace", row["workspace_id"]), "source_table": "memberships", "source_id": row["id"], "record_type": "personal_membership", "data": payload})
        elif workspace and workspace["type"] == "institution":
            unsupported = [code for code in codes if code not in SAFE_PERMISSION_CODES]
            if unsupported:
                specs.append({"legacy_workspace_id": None, "source_table": "memberships", "source_id": row["id"], "record_type": "unmapped_membership_permissions", "data": {"workspace_source_id": row["workspace_id"], "membership_source_id": row["id"], "permission_codes": unsupported}})
    for row in data["workspace_members"]:
        workspace = workspace_by_id.get(row["workspace_id"])
        payload = dict(row)
        payload["permissions"] = decoded_permissions(row)
        specs.append({"legacy_workspace_id": stable_id("legacy_workspace", row["workspace_id"]) if workspace and workspace["type"] == "personal" else None, "source_table": "workspace_members", "source_id": row["id"], "record_type": "workspace_member", "data": payload})
    for row in data["workspace_plans"]:
        workspace = workspace_by_id.get(row["workspace_id"])
        if workspace and workspace["type"] == "personal":
            payload = dict(row)
            payload["limits_json"] = json_value(row["limits_json"])
            specs.append({"legacy_workspace_id": stable_id("legacy_workspace", row["workspace_id"]), "source_table": "workspace_plans", "source_id": row["workspace_id"], "record_type": "personal_plan", "data": payload})
    for spec in specs:
        spec["id"] = stable_id("legacy_record", f'{spec["source_table"]}:{spec["source_id"]}:{spec["record_type"]}')
    return specs


def validate_source(data: dict[str, list[dict]], db: sqlite3.Connection) -> list[str]:
    problems = []
    ids = {row["id"] for row in data["users"]}
    spaces = {row["id"] for row in data["workspaces"]}
    execs = {row["id"] for row in data["executions"]}
    for row in data["workspaces"]:
        if row.get("type") not in ("personal", "institution"):
            problems.append(f"Tipo de workspace sem mapeamento: {row.get('id')} ({row.get('type')!r})")
    for row in data["users"]:
        if not row.get("id") or not row.get("email") or not row.get("name"):
            problems.append(f"users possui campos obrigatórios ausentes (id={row.get('id')!r}).")
    emails = [row["email"].strip().lower() for row in data["users"] if row.get("email")]
    for email, n in Counter(emails).items():
        if n > 1:
            problems.append(f"Email duplicado no SQLite: {email}")
    for table, user_col, space_col in (("memberships", "user_id", "workspace_id"), ("workspace_members", "user_id", "workspace_id"), ("files", "user_id", "workspace_id"), ("executions", "user_id", "workspace_id"), ("audit_logs", "user_id", "workspace_id"), ("workspace_invitations", "invited_by_user_id", "workspace_id")):
        for row in data[table]:
            if row.get(user_col) and row[user_col] not in ids:
                problems.append(f"FK SQLite inválida: {table}.{user_col}={row[user_col]}")
            if row.get(space_col) and row[space_col] not in spaces:
                problems.append(f"FK SQLite inválida: {table}.{space_col}={row[space_col]}")
    for row in data["workspaces"]:
        if row.get("owner_id") and row["owner_id"] not in ids:
            problems.append(f"FK SQLite inválida: workspaces.owner_id={row['owner_id']}")
    for table in ("execution_steps", "execution_approvals", "execution_messages"):
        for row in data[table]:
            if row.get("execution_id") not in execs:
                problems.append(f"FK SQLite inválida: {table}.execution_id={row.get('execution_id')}")
            if row.get("user_id") and row["user_id"] not in ids:
                problems.append(f"FK SQLite inválida: {table}.user_id={row['user_id']}")
    file_rows = {row["id"]: row for row in data["files"]}
    for row in data["executions"]:
        for used in json_value(row.get("used_files")) or []:
            file_id = used.get("id") if isinstance(used, dict) else used
            if file_id and (file_id not in file_rows or file_rows[file_id]["workspace_id"] != row["workspace_id"]):
                problems.append(f"Arquivo referenciado ausente ou fora do workspace: execution={row['id']}, file={file_id}")
    institutional_ids = {w["id"] for w in data["workspaces"] if w["type"] == "institution"}
    institutional_memberships = [row for row in data["memberships"] if row["workspace_id"] in institutional_ids]
    membership_pairs = [(row.get("user_id"), row.get("workspace_id")) for row in institutional_memberships]
    if len(membership_pairs) != len(set(membership_pairs)):
        problems.append("UNIQUE(source memberships user_id, institution_id) duplicada.")
    step_pairs = [(row.get("execution_id"), row.get("position")) for row in data["execution_steps"]]
    if len(step_pairs) != len(set(step_pairs)):
        problems.append("UNIQUE(source execution_steps execution_id, position) duplicada.")
    for violation in db.execute("PRAGMA foreign_key_check"):
        problems.append(f"FK SQLite inválida: {tuple(violation)}")
    for row in data["executions"]:
        for field in ("plan", "questions", "required_inputs", "used_files", "used_tools", "result"):
            if row.get(field) is not None:
                try:
                    json_value(row[field])
                except (ValueError, TypeError):
                    problems.append(f"JSON inválido em executions.{field} para {row['id']}.")
    for row in data["workspace_plans"]:
        try:
            json_value(row.get("limits_json"))
        except (ValueError, TypeError):
            problems.append(f"JSON inválido em workspace_plans para {row['workspace_id']}.")
    return problems


def build_plan(data: dict[str, list[dict]], existing: dict[str, int], existing_ids: dict[str, set[str]], permission_ids: dict[str, str]) -> dict:
    workspaces = {row["id"]: row for row in data["workspaces"]}
    personal = {key: row for key, row in workspaces.items() if row["type"] == "personal"}
    institutions = {key: row for key, row in workspaces.items() if row["type"] == "institution"}
    source_codes = {code for table in ("memberships", "workspace_members") for row in data[table] for code in decoded_permissions(row)}
    permission_codes = set(permission_ids)
    new_legacy_codes = source_codes - permission_codes
    legacy_records = legacy_record_specs(data, set(institutions))
    result_rows = [row for row in data["executions"] if row.get("result")]
    permission_links = []
    for row in data["memberships"]:
        if row["workspace_id"] not in institutions:
            continue
        for code in decoded_permissions(row):
            if code in SAFE_PERMISSION_CODES and code in permission_codes:
                permission_links.append(stable_id("membership_permission", f'{row["id"]}:{code}'))
    id_sets = {
        "users": {stable_id("user", row["id"]) for row in data["users"]},
        "institutions": {stable_id("institution", row["id"]) for row in institutions.values()},
        "legacy_workspaces": {stable_id("legacy_workspace", key) for key in personal},
        "memberships": {stable_id("membership", row["id"]) for row in data["memberships"] if row["workspace_id"] in institutions},
        "membership_permissions": set(permission_links),
        "invitations": {stable_id("invitation", row["id"]) for row in data["workspace_invitations"] if row["workspace_id"] in institutions},
        "plans": {stable_id("plan", "free") for row in data["workspace_plans"] if row["workspace_id"] in institutions},
        "subscriptions": {stable_id("subscription", row["workspace_id"]) for row in data["workspace_plans"] if row["workspace_id"] in institutions},
        "files": {stable_id("file", row["id"]) for row in data["files"]},
        "executions": {stable_id("execution", row["id"]) for row in data["executions"]},
        "execution_steps": {stable_id("execution_step", row["id"]) for row in data["execution_steps"]},
        "execution_approvals": {stable_id("execution_approval", row["id"]) for row in data["execution_approvals"]},
        "execution_messages": {stable_id("execution_message", row["id"]) for row in data["execution_messages"]},
        "execution_results": {stable_id("execution_result", row["id"]) for row in result_rows},
        "audit_logs": {stable_id("audit_log", row["id"]) for row in data["audit_logs"]},
        "legacy_records": {row["id"] for row in legacy_records},
    }
    projected = {}
    for table, ids in id_sets.items():
        projected[table] = existing[table] + len(ids - existing_ids[table])
    projected["permissions"] = existing["permissions"] + len(new_legacy_codes - permission_codes)
    return {"personal": personal, "institutions": institutions, "source_codes": source_codes,
            "new_legacy_codes": new_legacy_codes, "legacy_records": legacy_records,
            "result_rows": result_rows, "permission_links": permission_links,
            "projected": projected, "id_sets": id_sets, "permission_ids": permission_ids}


def sql_text(value) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, bytes):
        value = value.decode("utf-8", "strict")
    elif isinstance(value, str):
        value.encode("utf-8", "strict")
    return "'" + str(value).replace("'", "''") + "'"


def sql_uuid(value) -> str:
    return "NULL" if value is None else f"{sql_text(value)}::uuid"


def sql_time(value) -> str:
    return "NULL" if value is None else f"{sql_text(value)}::timestamptz"


def sql_json(value) -> str:
    if value is None:
        return "NULL"
    normalized = normalize_json_value(value)
    serialized = json.dumps(normalized, ensure_ascii=False, allow_nan=False, separators=(",", ":"))
    serialized.encode("utf-8", "strict")
    return f"{sql_text(serialized)}::jsonb"


def insert_sql(table: str, columns: list[str], values: list[str]) -> str:
    return f"INSERT INTO public.{table} ({','.join(columns)}) VALUES ({','.join(values)}) ON CONFLICT (id) DO NOTHING;"


def migration_sql(data: dict[str, list[dict]], plan: dict) -> str:
    spaces = {row["id"]: row for row in data["workspaces"]}
    users = {row["id"]: row for row in data["users"]}
    statements = ["SET LOCAL TIME ZONE 'UTC';"]
    # Historical scopes first, then users and institutions to satisfy FKs.
    for source_id, row in plan["personal"].items():
        statements.append(insert_sql("legacy_workspaces", ["id","source_id","name","workspace_type","source_owner_id","created_at","metadata"], [
            sql_uuid(stable_id("legacy_workspace", source_id)), sql_text(source_id), sql_text(row.get("name")), sql_text(row.get("type")), sql_text(row.get("owner_id")), sql_time(row.get("created_at")), "NULL"]))
    for source_id, row in users.items():
        statements.append(insert_sql("users", ["id","name","email","password_hash","status","created_at","updated_at"], [
            sql_uuid(stable_id("user", source_id)), sql_text(row.get("name")), sql_text(row.get("email")), sql_text(row.get("password_hash")), "NULL", sql_time(row.get("created_at")), "NULL"]))
    for code in sorted(plan["new_legacy_codes"]):
        statements.append(insert_sql("permissions", ["id","code","description","created_at","legacy_only"], [
            sql_uuid(stable_id("permission", code)), sql_text(code), "NULL", "NOW()", "TRUE"]))
    for source_id, row in plan["institutions"].items():
        statements.append(insert_sql("institutions", ["id","name","type","status","created_by","created_at","updated_at"], [
            sql_uuid(stable_id("institution", source_id)), sql_text(row.get("name")), sql_text(row.get("type")), "NULL",
            sql_uuid(stable_id("user", row.get("owner_id"))) if row.get("owner_id") else "NULL", sql_time(row.get("created_at")), "NULL"]))
    for row in data["memberships"]:
        if row["workspace_id"] not in plan["institutions"]:
            continue
        statements.append(insert_sql("memberships", ["id","user_id","institution_id","role","status","joined_at","left_at"], [
            sql_uuid(stable_id("membership", row["id"])), sql_uuid(stable_id("user", row["user_id"])),
            sql_uuid(stable_id("institution", row["workspace_id"])), sql_text("admin" if row.get("is_admin") else "member"), "NULL", "NULL", "NULL"]))
    for row in data["memberships"]:
        if row["workspace_id"] not in plan["institutions"]:
            continue
        for code in decoded_permissions(row):
            if code not in SAFE_PERMISSION_CODES:
                continue
            statements.append(insert_sql("membership_permissions", ["id","membership_id","permission_id","granted_at"], [
                sql_uuid(stable_id("membership_permission", f'{row["id"]}:{code}')),
                sql_uuid(stable_id("membership", row["id"])),
                sql_uuid(plan["permission_ids"].get(code) or stable_id("permission", code)), "NULL"]))
    # One institutional plan/subscription; personal plans remain archival records.
    for row in data["workspace_plans"]:
        if row["workspace_id"] not in plan["institutions"]:
            continue
        limits = json_value(row.get("limits_json"))
        plan_id = stable_id("plan", row.get("plan", "free"))
        statements.append(insert_sql("plans", ["id","name","description","price","limits","features","active","created_at"], [
            sql_uuid(plan_id), sql_text(row.get("plan")), "NULL", "NULL", sql_json(limits), "NULL", "TRUE", sql_time(row.get("created_at"))]))
        statements.append(insert_sql("subscriptions", ["id","institution_id","plan_id","status","started_at","expires_at","external_id"], [
            sql_uuid(stable_id("subscription", row["workspace_id"])), sql_uuid(stable_id("institution", row["workspace_id"])), sql_uuid(plan_id),
            sql_text(row.get("status")), sql_time(row.get("created_at")), "NULL", "NULL"]))
    for row in data["workspace_invitations"]:
        if row["workspace_id"] not in plan["institutions"]:
            continue
        statements.append(insert_sql("invitations", ["id","institution_id","invited_email","invited_by","token_hash","role","status","expires_at","accepted_at","created_at","updated_at"], [
            sql_uuid(stable_id("invitation", row["id"])), sql_uuid(stable_id("institution", row["workspace_id"])), sql_text(row.get("email")),
            sql_uuid(stable_id("user", row["invited_by_user_id"])), "NULL", sql_text(row.get("role")), sql_text(row.get("status")), "NULL", "NULL",
            sql_time(row.get("created_at")), sql_time(row.get("updated_at"))]))
    for row in data["files"]:
        workspace = spaces[row["workspace_id"]]
        legacy_id = stable_id("legacy_workspace", row["workspace_id"]) if workspace["type"] == "personal" else None
        institution_id = stable_id("institution", row["workspace_id"]) if workspace["type"] == "institution" else None
        storage_path = (Path("uploads") / str(row.get("stored_name"))).as_posix()
        statements.append(insert_sql("files", ["id","institution_id","uploaded_by","name","mime_type","size_bytes","storage_path","status","created_at","updated_at","legacy_workspace_id"], [
            sql_uuid(stable_id("file", row["id"])), sql_uuid(institution_id), sql_uuid(stable_id("user", row["user_id"])) if row.get("user_id") else "NULL",
            sql_text(row.get("name")), sql_text(row.get("content_type")), str(row.get("size")) if row.get("size") is not None else "NULL",
            sql_text(storage_path), "NULL", sql_time(row.get("created_at")), "NULL", sql_uuid(legacy_id)]))
    for row in data["executions"]:
        workspace = spaces[row["workspace_id"]]
        legacy_id = stable_id("legacy_workspace", row["workspace_id"]) if workspace["type"] == "personal" else None
        institution_id = stable_id("institution", row["workspace_id"]) if workspace["type"] == "institution" else None
        values = [stable_id("execution", row["id"]), stable_id("user", row["user_id"]), institution_id, row.get("command"), row.get("status"), row.get("created_at"),
                  row.get("intent"), json_value(row.get("plan")), json_value(row.get("questions")), json_value(row.get("required_inputs")),
                  json_value(row.get("used_files")), json_value(row.get("used_tools")), bool(row.get("approval_required")), row.get("approved_at"), row.get("updated_at"), legacy_id]
        statements.append(insert_sql("executions", ["id","user_id","institution_id","objective","status","created_at","intent","plan","questions","required_inputs","used_files","used_tools","approval_required","approved_at","updated_at","legacy_workspace_id"], [
            sql_uuid(values[0]), sql_uuid(values[1]), sql_uuid(values[2]), sql_text(values[3]), sql_text(values[4]), sql_time(values[5]), sql_text(values[6]),
            sql_json(values[7]), sql_json(values[8]), sql_json(values[9]), sql_json(values[10]), sql_json(values[11]),
            "TRUE" if values[12] else "FALSE", sql_time(values[13]), sql_time(values[14]), sql_uuid(values[15])]))
    for row in data["execution_steps"]:
        statements.append(insert_sql("execution_steps", ["id","execution_id","step_order","name","description","status","created_at","updated_at"], [
            sql_uuid(stable_id("execution_step", row["id"])), sql_uuid(stable_id("execution", row["execution_id"])), str(row.get("position")),
            sql_text(row.get("title")), sql_text(row.get("detail")), sql_text(row.get("status")), sql_time(row.get("created_at")), sql_time(row.get("updated_at"))]))
    for row in data["execution_approvals"]:
        approved_by = row.get("user_id") if row.get("decision") == "approved" else None
        statements.append(insert_sql("execution_approvals", ["id","execution_id","requested_at","approved_by","status","decided_at","decided_by"], [
            sql_uuid(stable_id("execution_approval", row["id"])), sql_uuid(stable_id("execution", row["execution_id"])), "NULL",
            sql_uuid(stable_id("user", approved_by)) if approved_by else "NULL", sql_text(row.get("decision")), sql_time(row.get("created_at")),
            sql_uuid(stable_id("user", row["user_id"])) if row.get("user_id") else "NULL"]))
    for row in data["execution_messages"]:
        statements.append(insert_sql("execution_messages", ["id","execution_id","user_id","role","content","created_at"], [
            sql_uuid(stable_id("execution_message", row["id"])), sql_uuid(stable_id("execution", row["execution_id"])),
            sql_uuid(stable_id("user", row["user_id"])) if row.get("user_id") else "NULL", sql_text(row.get("role")),
            sql_text(row.get("content")), sql_time(row.get("created_at"))]))
    for row in plan["result_rows"]:
        result = json_value(row["result"])
        summary = result.get("summary") if isinstance(result, dict) else None
        # DERIVED TIMESTAMP: SQLite has no per-result timestamp. Use the source
        # executions.updated_at value; executions.created_at is only the fallback.
        # This value is not the original timestamp of the result.
        result_time = row.get("updated_at") or row.get("created_at")
        statements.append(insert_sql("execution_results", ["id","execution_id","summary","result_data","created_at"], [
            sql_uuid(stable_id("execution_result", row["id"])), sql_uuid(stable_id("execution", row["id"])),
            sql_text(summary), sql_json(result), sql_time(result_time)]))
    for row in data["audit_logs"]:
        workspace = spaces.get(row.get("workspace_id"))
        is_personal = bool(workspace and workspace["type"] == "personal")
        institution_id = stable_id("institution", row["workspace_id"]) if workspace and workspace["type"] == "institution" else None
        legacy_id = stable_id("legacy_workspace", row["workspace_id"]) if is_personal else None
        entity_id = row.get("entity_id")
        entity_type = row.get("entity_type")
        if not entity_id:
            resource_id = None
        elif entity_type == "file":
            resource_id = stable_id("file", entity_id)
        elif entity_type == "execution":
            resource_id = stable_id("execution", entity_id)
        elif entity_type == "workspace_member":
            resource_id = stable_id("legacy_record", f"workspace_members:{entity_id}:workspace_member")
        else:
            resource_id = stable_id("audit_resource", f"{entity_type}:{entity_id}")
        statements.append(insert_sql("audit_logs", ["id","institution_id","user_id","action","resource_type","resource_id","metadata","created_at","legacy_workspace_id","source_entity_id"], [
            sql_uuid(stable_id("audit_log", row["id"])), sql_uuid(institution_id), sql_uuid(stable_id("user", row["user_id"])) if row.get("user_id") else "NULL",
            sql_text(row.get("action")), sql_text(row.get("entity_type")), sql_uuid(resource_id), sql_json(json_value(row.get("metadata"))),
            sql_time(row.get("created_at")), sql_uuid(legacy_id), sql_text(entity_id)]))
    for spec in plan["legacy_records"]:
        statements.append(insert_sql("legacy_records", ["id","legacy_workspace_id","source_table","source_id","record_type","data"], [
            sql_uuid(spec["id"]), sql_uuid(spec["legacy_workspace_id"]), sql_text(spec["source_table"]), sql_text(spec["source_id"]),
            sql_text(spec["record_type"]), sql_json(spec["data"])]))
    return "\n".join(statements)


def print_report(data: dict[str, list[dict]], plan: dict, existing: dict[str, int], projected: dict[str, int], orphan_files: list[str], fk_issues: list[str], conflicts: list[str]) -> None:
    report_rows = [
        ("USERS", len(data["users"]), projected["users"]),
        ("INSTITUTIONS", len(plan["institutions"]), projected["institutions"]),
        ("LEGACY_WORKSPACES", len(plan["personal"]), projected["legacy_workspaces"]),
        ("MEMBERSHIPS", sum(row["workspace_id"] in plan["institutions"] for row in data["memberships"]), projected["memberships"]),
        ("PERMISSIONS", len(plan["source_codes"]), projected["permissions"]),
        ("MEMBERSHIP_PERMISSIONS", len(plan["permission_links"]), projected["membership_permissions"]),
        ("INVITATIONS", sum(row["workspace_id"] in plan["institutions"] for row in data["workspace_invitations"]), projected["invitations"]),
        ("PLANS", sum(row["workspace_id"] in plan["institutions"] for row in data["workspace_plans"]), projected["plans"]),
        ("SUBSCRIPTIONS", sum(row["workspace_id"] in plan["institutions"] for row in data["workspace_plans"]), projected["subscriptions"]),
        ("FILES", len(data["files"]), projected["files"]),
        ("EXECUTIONS", len(data["executions"]), projected["executions"]),
        ("EXECUTION_STEPS", len(data["execution_steps"]), projected["execution_steps"]),
        ("EXECUTION_APPROVALS", len(data["execution_approvals"]), projected["execution_approvals"]),
        ("EXECUTION_MESSAGES", len(data["execution_messages"]), projected["execution_messages"]),
        ("EXECUTION_RESULTS", len(plan["result_rows"]), projected["execution_results"]),
        ("AUDIT_LOGS", len(data["audit_logs"]), projected["audit_logs"]),
        ("LEGACY_RECORDS", len(plan["legacy_records"]), projected["legacy_records"]),
    ]
    print("=== NOVO DRY-RUN ===")
    for name, source_count, target_count in report_rows:
        print(f"{name}: {source_count} → {target_count}")
    print("\nREGISTROS QUE FICARÃO SOMENTE NO SQLITE:")
    print(f"- SESSIONS: {len(data.get('sessions', []))} sessões antigas (não migradas).")
    print("- Os dados permanecem intactos no SQLite; workspaces pessoais também terão cópia histórica em legacy_workspaces.")
    print("\nARQUIVOS FÍSICOS ÓRFÃOS:")
    print("- " + (", ".join(orphan_files) if orphan_files else "nenhum"))
    print("\nPOSSÍVEIS PERDAS:")
    print("- Nenhum dado de origem é descartado: permissões sem correspondência e dados incompatíveis vão para legacy_records.")
    if plan["result_rows"]:
        print("- execution_results.created_at é um timestamp derivado; timestamp original do resultado não existe na origem SQLite.")
        print("- Origem do valor: executions.updated_at; executions.created_at é usado somente como fallback.")
        print("- Esse valor não deve ser apresentado como timestamp original do resultado.")
    id_conflicts = [item for item in conflicts if "UUID(s) determinísticos" in item]
    unique_conflicts = [item for item in conflicts if item not in id_conflicts]
    print("\nCONFLITOS:")
    print(f"- IDs: {len(id_conflicts)}" + (" (" + "; ".join(id_conflicts) + ")" if id_conflicts else ""))
    print(f"- Chaves únicas: {len(unique_conflicts)}" + (" (" + "; ".join(unique_conflicts) + ")" if unique_conflicts else ""))
    print("\nPOSSÍVEIS DUPLICAÇÕES:")
    print("- nenhuma duplicação prevista; UUIDv5 determinístico + ON CONFLICT(id) DO NOTHING")
    print(f"- Permissões legacy_only previstas: {len(plan['new_legacy_codes'])}; concedidas: 0")
    print(f"- Workspaces pessoais arquivados: {len(plan['personal'])}; convertidos em institutions: 0")
    print("\nINTEGRIDADE:")
    print(f"- FKs inválidas: {len(fk_issues)}" + (" (" + "; ".join(fk_issues) + ")" if fk_issues else ""))
    print(f"- Registros relacionais órfãos: {len(fk_issues)}")
    print(f"- Sessões antigas somente no SQLite: {len(data.get('sessions', []))}")
    print(f"- Arquivo físico órfão mantido sem remoção/registro: {len(orphan_files)}")
    print("\nCONTAGENS POSTGRESQL: " + ", ".join(f"{t}={existing[t]}→{projected[t]}" for t in TARGET_TABLES))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--dry-run", action="store_true", help="Somente consultas; não escreve em nenhum banco.")
    mode.add_argument("--apply", action="store_true", help="Aplica em uma transação PostgreSQL; nunca escreve no SQLite.")
    args = parser.parse_args()
    before = SQLITE_PATH.stat()
    with sqlite_connection() as db:
        data = source_snapshot(db)
        sessions = source_rows(db, "sessions")
        data["sessions"] = sessions
        fk_issues = validate_source(data, db)
        workspace_by_id = {row["id"]: row for row in data["workspaces"]}
        stored_names = {row["stored_name"] for row in data["files"]}
        physical_names = {p.name for p in UPLOADS.iterdir() if p.is_file()} if UPLOADS.is_dir() else set()
        orphan_files = sorted(physical_names - stored_names)
        missing_physical = sorted(stored_names - physical_names)
        if missing_physical:
            fk_issues.extend("Arquivo físico ausente: " + name for name in missing_physical)
    existing = target_counts()
    permission_ids = target_permission_map()
    existing_ids = {table: target_values(table, "id") for table in TARGET_TABLES if table != "permissions"}
    plan = build_plan(data, existing, existing_ids, permission_ids)
    conflicts = []
    for row in data["memberships"]:
        if row["workspace_id"] in plan["institutions"]:
            for code in decoded_permissions(row):
                if code in SAFE_PERMISSION_CODES and code not in permission_ids:
                    fk_issues.append(f"Permissão operacional sem UUID PostgreSQL: {code}")
    for row in data["users"]:
        mapped = stable_id("user", row["id"])
        if row.get("email") and row["email"].strip().lower() in {x.lower() for x in target_values("users", "email")} and mapped not in existing_ids["users"]:
            conflicts.append(f"email já existe no PostgreSQL: {row['email']}")
    if "free" in target_values("plans", "name") and stable_id("plan", "free") not in existing_ids["plans"]:
        conflicts.append("já existe plano PostgreSQL chamado free com ID diferente")
    for table, ids in plan["id_sets"].items():
        overlap = ids & existing_ids[table]
        if overlap:
            conflicts.append(f"{table}: {len(overlap)} UUID(s) determinísticos já existem; serão tratados como repetição idempotente")
    projected = plan["projected"]
    # Build and validate the exact SQL payload used by --apply, even during
    # --dry-run. This catches encoding/JSON failures before any write path.
    sql = migration_sql(data, plan)
    utf8_values, utf8_issues = validate_utf8_payload(data, sql)
    if utf8_issues:
        for issue in utf8_issues:
            print("UTF-8/serialization invalid: " + issue, file=sys.stderr)
        raise MigrationError(f"UTF-8 validation failed for {len(utf8_issues)} value(s); no writes performed.")
    print_report(data, plan, existing, projected, orphan_files, fk_issues, conflicts)
    if fk_issues:
        raise MigrationError("Dry-run encontrou referências/valores inválidos; nenhuma escrita foi feita.")
    if args.dry_run:
        after_counts = target_counts()
        after = SQLITE_PATH.stat()
        unchanged = before.st_size == after.st_size and before.st_mtime_ns == after.st_mtime_ns
        if existing != after_counts:
            raise MigrationError("Contagens PostgreSQL mudaram durante o dry-run; verifique concorrência.")
        if not unchanged:
            raise MigrationError("SQLite mudou durante o dry-run; nenhuma operação de escrita foi executada pelo script.")
        print("\nVALIDAÇÃO DRY-RUN:")
        print("- INSERT/UPDATE/DELETE executados: 0")
        print(f"- Valores/SQL preparados e validados em UTF-8 estrito: {utf8_values}; problemas: 0")
        print("- PostgreSQL sem alterações: OK")
        print("- SQLite somente leitura e intacto: OK")
        print("- Script terminou sem exceção: OK")
        return 0
    run_psql(sql, read_only=False)
    final_counts = target_counts()
    print("\nAPLICAÇÃO CONCLUÍDA; contagens finais: " + ", ".join(f"{t}={final_counts[t]}" for t in TARGET_TABLES))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (MigrationError, sqlite3.Error, OSError, ValueError, KeyError, TypeError) as exc:
        print("ERRO DE MIGRAÇÃO: " + str(exc), file=sys.stderr)
        raise SystemExit(1)
