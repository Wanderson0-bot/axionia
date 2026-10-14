import { useEffect, useRef, useState } from "react";
import { Routes, Route, useNavigate, useParams } from "react-router-dom";
import { AppShell } from "./components/layout";
import {
  Button,
  PageHeader,
  Select,
  StatCard,
  StatusBadge,
  Toast,
} from "./components/ui";

import { AuthProvider, useAuth } from "./hooks/useAuth";
import { AuthScreen } from "./components/auth";
import { useWorkspaces } from "./hooks/useWorkspaces";
import {
  approveExecution,
  cancelExecution,
  clarifyExecution,
  createExecution,
  getExecution,
  getExecutionHistory,
  getFiles,
  runExecution,
  uploadFiles,
  type ApiExecution,
} from "./services/api";
import { acceptedExtensions, toAttachedFile } from "./utils/files";
import type {
  AttachedFile,
  Execution,
  ExecutionStatus,
  UserAccount,
} from "./types";
import {
  ArrowRight,
  Paperclip,
  Send,
  Sparkles,
  FileText,
  CheckCircle2,
  ShieldCheck,
  Search,
  Upload,
  ExternalLink,
  X,
} from "lucide-react";
function WorkspaceControl({
  loading,
  error,
  workspaces,
  workspaceId,
  setWorkspaceId,
}: ReturnType<typeof useWorkspaces>) {
  const institutions = workspaces.filter((workspace) => workspace.type === "institution");
  if (!institutions.length) {
    return (
      <div className="filters">
        <label>
          <b>Workspace</b>
          <span className="form-empty">Nenhuma instituição disponível</span>
        </label>
        {loading && <span>Carregando workspaces…</span>}
        {error && <span className="form-error">{error}</span>}
      </div>
    );
  }
  if (institutions.length === 1) {
    return (
      <div className="filters">
        <label>
          <b>Workspace</b>
          <span className="form-empty">{institutions[0].name}</span>
        </label>
        {loading && <span>Carregando workspaces…</span>}
        {error && <span className="form-error">{error}</span>}
      </div>
    );
  }
  return (
    <div className="filters">
      <label>
        <b>Workspace</b>
        <Select onChange={setWorkspaceId} value={workspaceId}>
          {institutions.map((workspace) => (
            <option
              key={workspace.id}
              value={workspace.id}
            >
              {workspace.name}
            </option>
          ))}
        </Select>
      </label>
      {loading && <span>Carregando workspaces…</span>}
      {error && <span className="form-error">{error}</span>}
    </div>
  );
}
const examples = [
  "Analise uma planilha de notas e identifique alunos que precisam de reforço.",
  "Crie uma avaliação de matemática com gabarito.",
  "Organize estes documentos por categoria.",
  "Gere um relatório a partir dos dados enviados.",
];
const displayStatus = (status: ExecutionStatus) =>
  status === "awaiting_approval"
    ? "approval"
    : status === "pending_clarification"
      ? "attention"
    : status === "approved" || status === "running"
      ? "running"
      : status === "completed"
        ? "completed"
        : status === "cancelled"
          ? "cancelled"
          : status === "failed"
            ? "attention"
            : "attention";
function UploadControl({
  files,
  onAdd,
  onRemove,
  toast,
  compact = false,
  allowRemove = true,
}: {
  files: AttachedFile[];
  onAdd: (items: File[]) => void;
  onRemove: (id: string) => void;
  toast: (message: string) => void;
  compact?: boolean;
  allowRemove?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const take = (items: FileList | null) => {
    if (!items) return;
    const valid: File[] = [];
    for (const file of Array.from(items)) {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (!ext || !acceptedExtensions.includes(ext)) {
        toast(`${file.name}: formato não aceito`);
        continue;
      }
      valid.push(file);
    }
    if (valid.length) onAdd(valid);
  };
  return (
    <>
      {!compact && (
        <div
          className="upload"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            take(e.dataTransfer.files);
          }}
          onClick={() => ref.current?.click()}
        >
          <Upload size={22} />
          <div>
            <b>Arraste arquivos aqui ou selecione do seu dispositivo</b>
            <p>
              PDF, XLSX, CSV, DOCX e imagens · enviado somente quando você
              iniciar a execução
            </p>
          </div>
        </div>
      )}
      <input
        ref={ref}
        type="file"
        hidden
        multiple
        accept=".pdf,.csv,.xlsx,.docx,.png,.jpg,.jpeg,.webp"
        onChange={(e) => take(e.target.files)}
      />
      {compact && (
        <button
          className="icon-btn"
          aria-label="Anexar arquivos"
          onClick={() => ref.current?.click()}
        >
          <Paperclip size={18} />
        </button>
      )}
      {files.length > 0 && (
        <div className={compact ? "attached-files" : "file-list"}>
          {files.map((file) =>
            compact ? (
              <span className="attachment" key={file.id}>
                <FileText size={15} />
                {file.name}
                {allowRemove && (
                  <button
                    aria-label={"Remover " + file.name}
                    onClick={() => onRemove(file.id)}
                  >
                    <X size={13} />
                  </button>
                )}
              </span>
            ) : (
              <article className="file" key={file.id}>
                <span className={"file-type " + file.type.toLowerCase()}>
                  {file.type}
                </span>
                <div>
                  <b>{file.name}</b>
                  <p>
                    {file.size} ·{" "}
                    {file.status === "Processando"
                      ? "Enviando para a AXION local"
                      : "Pronto para uso"}
                  </p>
                </div>
                <span className="ready">
                  <CheckCircle2 size={15} />
                  {file.status}
                </span>
                {allowRemove && (
                  <button
                    aria-label={"Remover " + file.name}
                    onClick={() => onRemove(file.id)}
                  >
                    <X size={17} />
                  </button>
                )}
              </article>
            ),
          )}
        </div>
      )}
    </>
  );
}
function New({
  toast,
  start,
  name,
}: {
  toast: (s: string) => void;
  start: (command: string, files: AttachedFile[]) => Promise<Execution>;
  name: string;
}) {
  const nav = useNavigate(),
    [cmd, setCmd] = useState(""),
    [attached, setAttached] = useState<AttachedFile[]>([]);
  const add = (selected: File[]) => {
    const items = selected.map(toAttachedFile);
    setAttached((current) => [...current, ...items]);
  };
  const execute = async () => {
    try {
      const execution = await start(cmd, attached);
      nav("/execution/" + execution.id);
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "Falha ao iniciar execução",
      );
    }
  };
  return (
    <section className="hero">
      <p className="eyebrow">Olá, {name}</p>
      <h1>O que você precisa executar?</h1>
      <p className="lead">
        Descreva um objetivo, envie arquivos ou solicite uma tarefa.
      </p>
      <div className="command">
        <textarea
          value={cmd}
          onChange={(e) => setCmd(e.target.value)}
          placeholder="Descreva uma tarefa ou objetivo..."
        />
        <div className="command-bar">
          <UploadControl
            compact
            files={attached}
            onAdd={add}
            onRemove={(id) =>
              setAttached((items) => items.filter((item) => item.id !== id))
            }
            toast={toast}
            allowRemove={false}
          />
          <span className="tool-note">
            <Sparkles size={15} /> AXION pode utilizar ferramentas
          </span>
          <Button disabled={!cmd.trim()} onClick={execute}>
            Executar <Send size={16} />
          </Button>
        </div>
      </div>
      <div className="keys">
        <span>⌘ Enter para executar</span>
        <span>Arquivos: PDF, XLSX, CSV, DOCX e imagens</span>
      </div>
      <div className="suggest">
        <h2>Sugestões para começar</h2>
        <div className="suggest-grid">
          {examples.map((x, i) => (
            <button key={x} onClick={() => setCmd(x)}>
              <span>0{i + 1}</span>
              {x}
              <ArrowRight size={16} />
            </button>
          ))}
        </div>
      </div>
      <p className="privacy">
        <ShieldCheck size={16} /> Seus arquivos e execuções ficam sob seu
        controle.
      </p>
    </section>
  );
}
function ExecutionPage({
  current,
  run,
  clarify,
}: {
  current: Execution | null;
  run: (execution: Execution, approval: () => void, done: () => void) => void;
  clarify: (
    answers: Record<string, string>,
    files?: AttachedFile[],
  ) => Promise<void>;
}) {
  const nav = useNavigate();
  const { id } = useParams();
  const execution = current?.id === id ? current : null;
  const started = useRef(false);
  const [clarification, setClarification] = useState("");
  const [clarificationFiles, setClarificationFiles] = useState<AttachedFile[]>(
    [],
  );
  useEffect(() => {
    if (execution && !started.current) {
      started.current = true;
      run(
        execution,
        () => nav("/approval/" + execution.id),
        () => nav("/result/" + execution.id),
      );
    }
  }, [execution, nav, run]);
  if (!execution) return <Missing />;
  return (
    <section className="content narrow">
      <PageHeader eyebrow="EXECUÇÃO" title={execution.title}>
        <StatusBadge status={displayStatus(execution.status)} />
      </PageHeader>
      <article className="command-recap">“{execution.command}”</article>
      {execution.status === "pending_clarification" && execution.questions?.length ? (
        <article className="approval-panel">
          <h2>Esclarecimentos necessários</h2>
          {execution.questions.map((question) => (
            <p key={question}>{question}</p>
          ))}
          <textarea
            value={clarification}
            onChange={(event) => setClarification(event.target.value)}
            placeholder="Informe os detalhes solicitados..."
          />
          <UploadControl
            compact
            files={clarificationFiles}
            onAdd={(files) => setClarificationFiles(files.map(toAttachedFile))}
            onRemove={(fileId) =>
              setClarificationFiles((items) =>
                items.filter((file) => file.id !== fileId),
              )
            }
            toast={() => undefined}
          />
          <Button
            disabled={!clarification.trim() && !clarificationFiles.length}
            onClick={() =>
              clarify({ resposta: clarification }, clarificationFiles)
            }
          >
            Enviar esclarecimento
          </Button>
        </article>
      ) : null}
      {execution.status === "awaiting_approval" && (
        <article className="approval-panel">
          <h2>Aguardando aprovação</h2>
          <p>Esta execução foi criada e está esperando autorização humana.</p>
        </article>
      )}
      <div className="timeline">
        {execution.steps.map((step) => (
          <article
            className={
              (step.state === "done"
                ? "done "
                : step.state === "active"
                  ? "active "
                  : "") + "step"
            }
            key={step.title}
          >
            <span>
              {step.state === "done" ? <CheckCircle2 size={19} /> : <i />}
            </span>
            <div>
              <b>{step.title}</b>
              <p>{step.description}</p>
            </div>
            <small>{step.state === "done" ? "ok" : step.state === "active" ? "agora" : "pendente"}</small>
          </article>
        ))}
      </div>
      {execution.tools.length > 0 && (
        <div className="tools">
          <span>Ferramentas utilizadas</span>
          {execution.tools.map((tool) => (
            <b key={tool.name}>
              {tool.name} ·{" "}
              {tool.status === "done"
                ? "concluída"
                : tool.status === "active"
                  ? "em andamento"
                  : "aguardando"}
            </b>
          ))}
        </div>
      )}
    </section>
  );
}
function Result({
  current,
  history,
  open,
}: {
  current: Execution | null;
  history: Execution[];
  open: (id: string) => Execution | null;
}) {
  const { id } = useParams();
  const execution = current?.id === id ? current : open(id || "");
  const nav = useNavigate();
  if (!execution) return <Missing />;
  const result = execution.result;
  return (
    <section className="content">
      <PageHeader eyebrow="EXECUÇÃO CONCLUÍDA" title={execution.title}>
        <div className="actions">
          <Button onClick={() => nav("/")}>Nova execução</Button>
        </div>
      </PageHeader>
      {execution.status === "completed" ? (
        <>
          <div className="result-top">
            <StatusBadge status="completed" />
            <span>Concluído em {execution.date}</span>
          </div>
          <article className="executive">
            <p>Resumo executivo</p>
            <h2>
              {result.headline} <em>{result.emphasis}</em>
            </h2>
            <span>{result.description}</span>
          </article>
          {result.stats.length > 0 && (
            <div className="stats">
              {result.stats.map((stat) => (
                <StatCard key={stat.label} {...stat} />
              ))}
            </div>
          )}
          {result.table.headers.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {result.table.headers.map((header) => (
                      <th key={header}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.table.rows.map((row, index) => (
                    <tr key={index}>
                      {row.map((cell, i) => (
                        <td key={i}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {result.recommendations.length > 0 && (
            <div className="recommend">
              <div>
                <Sparkles size={19} />
                <h2>Recomendações da AXION</h2>
              </div>
              <ol>
                {result.recommendations.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            </div>
          )}
        </>
      ) : (
        <article className="approval-panel">
          <h2>Estado da execução</h2>
          <p>{execution.status === "failed" ? "O processamento falhou." : execution.status === "cancelled" ? "Esta execução foi cancelada." : "Ainda não há resultado final disponível."}</p>
          {execution.result?.warnings?.length ? (
            <ul>
              {execution.result.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
        </article>
      )}
    </section>
  );
}
function Approval({
  current,
  history,
  open,
  approve,
  cancel,
  toast,
}: {
  current: Execution | null;
  history: Execution[];
  open: (id: string) => Execution | null;
  approve: (done: () => void) => void;
  cancel: () => void;
  toast: (s: string) => void;
}) {
  const nav = useNavigate();
  const { id } = useParams();
  const execution = current?.id === id ? current : open(id || "");
  if (!execution) return <Missing />;
  const cancelled = execution.status === "cancelled";
  return (
    <section className="content narrow approval">
      <div className="approval-icon">
        <ShieldCheck size={28} />
      </div>
      <p className="eyebrow">CONTROLE HUMANO</p>
      <h1>
        {cancelled ? "Execução cancelada." : "Ação aguardando sua aprovação"}
      </h1>
      <p className="lead">
        {cancelled
          ? "Nenhuma ação foi realizada."
          : "A AXION nunca executa ações externas sem sua autorização."}
      </p>
      {!cancelled && (
        <article className="approval-panel">
          <div>
            <span>AÇÃO PROPOSTA</span>
            <h2>{execution.title}</h2>
          </div>
          <dl>
            <dt>Comando original</dt>
            <dd>
              {execution.command || "Essa informação não foi especificada."}
            </dd>
            <dt>Arquivos utilizados</dt>
            <dd>
              {execution.files.length
                ? execution.files.map((file) => file.name).join(", ")
                : "Nenhum arquivo será utilizado."}
            </dd>
            <dt>Etapas e impacto</dt>
            <dd>
              {execution.steps.length
                ? execution.steps.map((step) => step.title).join(" · ")
                : "Essa informação não foi especificada."}
            </dd>
            <dt>Ferramentas e resultado esperado</dt>
            <dd>
              {execution.tools.length
                ? execution.tools.map((tool) => tool.name).join(", ")
                : "Essa informação não foi especificada."}
              . Após a autorização, a AXION processará os dados e mostrará o
              resultado.
            </dd>
          </dl>
          <div className="approval-actions">
            <Button variant="ghost" onClick={() => nav("/")}>
              Editar
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                cancel();
                toast("Execução cancelada");
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => approve(() => nav("/result/" + execution.id))}
            >
              Aprovar ação <CheckCircle2 size={16} />
            </Button>
          </div>
        </article>
      )}
    </section>
  );
}
function History({
  history,
  open,
}: {
  history: Execution[];
  open: (id: string) => Execution | null;
}) {
  const nav = useNavigate(),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all");
  const rows = history.filter(
    (x) =>
      (filter === "all" || displayStatus(x.status) === filter) &&
      (x.title.toLowerCase().includes(query.toLowerCase()) ||
        x.command.toLowerCase().includes(query.toLowerCase())),
  );
  return (
    <section className="content">
      <PageHeader title="Histórico de execuções">
        <Button onClick={() => nav("/")}>Nova execução</Button>
      </PageHeader>
      <div className="filters">
        <label>
          <Search size={17} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar execução"
          />
        </label>
        <Select onChange={setFilter}>
          <option value="all">Todos os status</option>
          <option value="completed">Concluído</option>
          <option value="approval">Aguardando aprovação</option>
          <option value="cancelled">Cancelado</option>
        </Select>
        <Select>
          <option>Últimos 30 dias</option>
        </Select>
      </div>
      {rows.length === 0 ? (
        <article className="approval-panel">
          <h2>Nenhuma execução encontrada</h2>
          <p>Não há registros reais para este workspace no momento.</p>
        </article>
      ) : (
        <div className="table-wrap history">
          <table>
            <thead>
              <tr>
                <th>Execução</th>
                <th>Status</th>
                <th>Arquivos</th>
                <th>Data</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((x) => (
                <tr key={x.id}>
                  <td>
                    <b>{x.title}</b>
                    <small>{x.command}</small>
                  </td>
                  <td>
                    <StatusBadge status={displayStatus(x.status)} />
                  </td>
                  <td>
                    {x.files.length} arquivo{x.files.length !== 1 ? "s" : ""}
                  </td>
                  <td>{x.date}</td>
                  <td>
                    <button
                      className="row-action"
                      aria-label={"Abrir " + x.title}
                      onClick={() => {
                        open(x.id);
                        nav(
                          x.status === "awaiting_approval"
                            ? "/approval/" + x.id
                            : x.status === "pending_clarification"
                              ? "/execution/" + x.id
                              : "/result/" + x.id,
                        );
                      }}
                    >
                      <ExternalLink size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
function Files({
  toast,
  workspaceId,
}: {
  toast: (s: string) => void;
  workspaceId: string;
}) {
  const [q, setQ] = useState(""),
    [items, setItems] = useState<AttachedFile[]>([]);
  useEffect(() => {
    if (!workspaceId) return;
    getFiles(workspaceId)
      .then((rows) =>
        setItems(
          rows.map((row) => ({
            id: row.id,
            name: row.name,
            type: row.type,
            size: `${Math.max(1, Math.round(row.size / 1024))} KB`,
            status: "Pronto",
          })),
        ),
      )
      .catch((error) => {
        toast(error instanceof Error ? error.message : "Falha ao carregar arquivos");
      });
  }, [toast, workspaceId]);
  const add = async (selected: File[]) => {
    try {
      const uploaded = await uploadFiles(selected, workspaceId);
      const next: AttachedFile[] = uploaded.map((file) => ({
        id: file.id,
        name: file.name,
        type: file.type,
        size: `${Math.max(1, Math.round(file.size / 1024))} KB`,
        status: "Pronto",
      }));
      setItems((current) => [...next, ...current.filter((item) => !next.some((x) => x.id === item.id))]);
      toast("Arquivos enviados ao backend");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Falha no upload");
    }
  };
  const filtered = items.filter((item) => item.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <section className="content">
      <PageHeader title="Arquivos">
        <Button
          onClick={() =>
            document.getElementById("file-upload-control")?.click()
          }
        >
          <Upload size={16} /> Adicionar arquivos
        </Button>
      </PageHeader>
      <div id="file-upload-control">
        <UploadControl
          files={items}
          onAdd={add}
          onRemove={(id) =>
            setItems((all) => all.filter((item) => item.id !== id))
          }
          toast={toast}
          allowRemove={false}
        />
      </div>
      <div className="filters">
        <label>
          <Search size={17} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar arquivos"
          />
        </label>
        <Select>
          <option>Todos os tipos</option>
        </Select>
      </div>
      {filtered.length === 0 ? (
        <article className="approval-panel">
          <h2>Nenhum arquivo encontrado</h2>
          <p>Os arquivos carregados para este workspace aparecerão aqui.</p>
        </article>
      ) : (
        <div className="file-list">
          {filtered.map((file) => (
            <article className="file" key={file.id}>
              <span className={"file-type " + file.type.toLowerCase()}>{file.type}</span>
              <div>
                <b>{file.name}</b>
                <p>{file.size}</p>
              </div>
              <span className="ready">
                <CheckCircle2 size={15} />
                {file.status}
              </span>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
function Settings({ toast }: { toast: (s: string) => void }) {
  const { user } = useAuth();
  const [external, setExternal] = useState(false),
    [human, setHuman] = useState(true);
  const accountType = user?.account_type === "institution" ? "Institucional" : "Individual";
  return (
    <section className="content settings">
      <PageHeader title="Configurações" />
      <article>
        <h2>Perfil</h2>
        <div className="setting-grid">
          <label>
            Nome
            <input value={user?.name || "Não configurado"} readOnly />
          </label>
          <label>
            E-mail
            <input value={user?.email || "Não configurado"} readOnly />
          </label>
          <label>
            Conta
            <input value={accountType} readOnly />
          </label>
          <label>
            Plano
            <input value="Free" readOnly />
          </label>
        </div>
      </article>
      <article>
        <h2>Preferências de execução</h2>
        <Toggle
          label="Permitir ações externas"
          desc="Autorize a AXION a preparar ações em ferramentas conectadas."
          value={external}
          set={setExternal}
        />
        <Toggle
          label="Confirmação humana obrigatória"
          desc="Solicitar aprovação antes de qualquer ação de impacto externo."
          value={human}
          set={setHuman}
        />
      </article>
    </section>
  );
}
function Toggle({
  label,
  desc,
  value,
  set,
}: {
  label: string;
  desc: string;
  value: boolean;
  set: (value: boolean) => void;
}) {
  return (
    <div className="toggle-row">
      <div>
        <b>{label}</b>
        <p>{desc}</p>
      </div>
      <button
        className={value ? "toggle on" : "toggle"}
        aria-pressed={value}
        onClick={() => set(!value)}
      >
        <i />
      </button>
    </div>
  );
}
function EmptyWorkspaceState() {
  return (
    <section className="content">
      <PageHeader title="Instituições" />
      <article className="approval-panel">
        <h2>Nenhuma instituição disponível</h2>
        <p>Seu usuário está autenticado, mas ainda não pertence a uma instituição ativa.</p>
      </article>
    </section>
  );
}
function Missing() {
  return (
    <section className="content">
      <PageHeader title="Execução não encontrada" />
      <p className="lead">
        Selecione uma execução no histórico ou inicie uma nova.
      </p>
    </section>
  );
}
function AuthenticatedApp() {
  const [toast, setToast] = useState("");
  const { user, logout } = useAuth();
  const workspaceState = useWorkspaces();
  const [current, setCurrent] = useState<Execution | null>(null);
  const [history, setHistory] = useState<Execution[]>([]);
  const adaptApiExecution = (x: ApiExecution): Execution => {
    const result = x.result || {
      summary: "Aguardando resposta do backend.",
      metrics: {},
      insights: [],
      warnings: [],
      sources: [],
      files: [],
      details: {},
    };
    const metrics = Object.entries(result.metrics || {}).map(([label, value]) => ({
      label,
      value: Array.isArray(value) ? value.join(", ") : String(value),
      detail: "",
    }));
    const details = result.details || {};
    return {
      id: x.id,
      workspaceId: x.workspace_id,
      title: x.intent.replace(/_/g, " ") || "Execução AXION",
      type: x.intent,
      date: new Date(x.created_at).toLocaleString("pt-BR"),
      status: x.status as ExecutionStatus,
      files: x.used_files.map((f) => ({
        id: f.id,
        name: f.name,
        type: "ARQUIVO",
        size: "",
        status: "Pronto",
      })),
      duration: "",
      command: x.command,
      steps: (x.plan.length ? x.plan : ["Aguardando processamento."]).map((title, i) => ({
        title,
        description: x.questions[i] || "Etapa do backend.",
        time: "",
        state: x.status === "completed" ? "done" : i === 0 ? "active" : "pending",
      })),
      tools: x.used_tools.map((name) => ({
        name,
        status: x.status === "completed" ? "done" : "pending",
        duration: "",
        summary: "Ferramenta real",
      })),
      result: {
        headline: result.summary || "Execução iniciada",
        emphasis: "",
        description: (result.insights || []).join(" ") || "Nenhum resultado adicional foi retornado.",
        stats: metrics,
        table: {
          headers: details.columns || [],
          rows: (details.preview || []).map((r: Record<string, unknown>) => Object.values(r).map(String)),
        },
        recommendations: result.insights || [],
        warnings: result.warnings || [],
        sources: result.sources || [],
        outputFiles: result.files || [],
      },
      requiresApproval: x.approval_required,
      questions: x.questions,
      createdAt: x.created_at,
    };
  };
  const syncExecution = (x: ApiExecution) => {
    const e = adaptApiExecution(x);
    setCurrent(e);
    setHistory((all) => [e, ...all.filter((item) => item.id !== e.id)]);
    return e;
  };
  useEffect(() => {
    if (!workspaceState.workspaceId) return;
    getExecutionHistory(workspaceState.workspaceId)
      .then((items) => setHistory(items.map(adaptApiExecution)))
      .catch(() => setHistory([]));
  }, [workspaceState.workspaceId]);
  const start = async (command: string, files: AttachedFile[]) => {
    if (!workspaceState.workspaceId) throw new Error("Selecione um workspace antes de executar.");
    const uploaded = files.length
      ? await uploadFiles(files.filter((file) => file.file).map((file) => file.file!), workspaceState.workspaceId)
      : [];
    const created = await createExecution(command, uploaded.map((file) => file.id), workspaceState.workspaceId);
    const execution = syncExecution(created);
    setCurrent(execution);
    return execution;
  };
  const run = (execution: Execution, onApproval: () => void, onComplete: () => void) => {
    if (execution.status === "awaiting_approval") onApproval();
    if (execution.status === "completed" || execution.status === "failed" || execution.status === "cancelled") onComplete();
  };
  const clarify = async (answers: Record<string, string>, files: AttachedFile[] = []) => {
    if (!current) return;
    const uploaded = files.length
      ? await uploadFiles(files.filter((file) => file.file).map((file) => file.file!), current.workspaceId)
      : [];
    const refreshed = await clarifyExecution(current.id, answers, uploaded.map((file) => file.id));
    syncExecution(refreshed);
  };
  const approve = async (onComplete: () => void) => {
    if (!current) return;
    const approved = await approveExecution(current.id);
    syncExecution(approved);
    const executed = await runExecution(current.id);
    syncExecution(executed);
    onComplete();
  };
  const cancel = async () => {
    if (!current) return;
    syncExecution(await cancelExecution(current.id));
  };
  const open = (id: string) => {
    const found = history.find((item) => item.id === id) || null;
    if (found) setCurrent(found);
    getExecution(id)
      .then((item) => syncExecution(item))
      .catch(() => undefined);
    return found;
  };
  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3500);
  };
  if (!user) return null;
  const accountType = user.account_type === "institution" ? "institution" : "individual";
  const account: UserAccount = {
    id: user.id,
    name: user.name || "Não configurado",
    email: user.email || "Não configurado",
    accountType,
    plan: "Não disponível",
  };
  const canUseInstitution = Boolean(workspaceState.workspaceId);
  return (
    <AppShell account={account} onLogout={logout}>
      <WorkspaceControl {...workspaceState} />
      <Routes>
        <Route
          path="/"
          element={
            canUseInstitution ? (
              <New toast={notify} start={start} name={account.name} />
            ) : (
              <EmptyWorkspaceState />
            )
          }
        />
        <Route
          path="/execution/:id"
          element={
            canUseInstitution ? (
              <ExecutionPage
                current={current}
                run={run}
                clarify={clarify}
              />
            ) : (
              <EmptyWorkspaceState />
            )
          }
        />
        <Route
          path="/result/:id"
          element={
            canUseInstitution ? (
              <Result
                current={current}
                history={history}
                open={open}
              />
            ) : (
              <EmptyWorkspaceState />
            )
          }
        />
        <Route
          path="/approval/:id"
          element={
            canUseInstitution ? (
              <Approval
                current={current}
                history={history}
                open={open}
                approve={approve}
                cancel={cancel}
                toast={notify}
              />
            ) : (
              <EmptyWorkspaceState />
            )
          }
        />
        <Route
          path="/history"
          element={
            canUseInstitution ? <History history={history} open={open} /> : <EmptyWorkspaceState />
          }
        />
        <Route
          path="/results"
          element={
            canUseInstitution ? (
              <History history={history.filter((x) => x.status === "completed")} open={open} />
            ) : (
              <EmptyWorkspaceState />
            )
          }
        />
        <Route
          path="/files"
          element={
            canUseInstitution ? (
              <Files toast={notify} workspaceId={workspaceState.workspaceId} />
            ) : (
              <EmptyWorkspaceState />
            )
          }
        />
        <Route path="/settings" element={<Settings toast={notify} />} />
        <Route
          path="*"
          element={
            canUseInstitution ? (
              <New toast={notify} start={start} name={account.name} />
            ) : (
              <EmptyWorkspaceState />
            )
          }
        />
      </Routes>
      {toast && <Toast text={toast} onClose={() => setToast("")} />}
    </AppShell>
  );
}
function Gate() {
  const { state } = useAuth();
  if (state === "checking_session" || state === "logging_out")
    return (
      <section className="onboarding">
        <p className="lead">Verificando sessão…</p>
      </section>
    );
  return state === "authenticated" ? <AuthenticatedApp /> : <AuthScreen />;
}
export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}

