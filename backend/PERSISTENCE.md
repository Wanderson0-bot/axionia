# AXION IA — Persistência SQLite inicial

## Auditoria do schema anterior

O banco existente foi criado diretamente em `app/local.py` por `CREATE TABLE IF NOT EXISTS`. Tabelas legadas: `users`, `sessions`, `workspaces`, `memberships`, `workspace_members`, `files` e `executions`. Todas usam IDs textuais; antes desta etapa não havia tabela de versão, foreign keys formais, constraints de status nas entidades novas nem índices explícitos. Consultas SQL estavam concentradas em `app/local.py`, acopladas às rotas e regras de negócio.

## Diagrama textual

`users 1—N sessions`  
`users 1—N workspaces (owner_id)`  
`users N—N workspaces via memberships`  
`workspaces 1—N workspace_members`  
`workspaces 1—N files` / `users 1—N files`  
`workspaces 1—N executions` / `users 1—N executions`  
`executions 1—N execution_steps / execution_approvals / execution_messages`  
`workspaces 1—N workspace_invitations / audit_logs`

## Migrações

`app/db/migrations.py` mantém a tabela `schema_migrations` e aplica versões em ordem, uma vez. Nenhuma migração remove ou recria tabelas existentes. A versão 1 cria as entidades normalizadas operacionais; a versão 2 aplica índices após confirmação do schema.

## Provisórios

As tabelas legadas continuam por compatibilidade com as rotas atuais. O próximo passo é mover SQL de `local.py` para repositórios transacionais e passar a gravar etapas, aprovações, mensagens, convites e logs nas tabelas novas. SQLite continua adequado ao modo local; a modelagem usa relações e SQL portável para futura migração PostgreSQL.
