const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";
const TOKEN_KEY = "axion-session-token";
const token = () => localStorage.getItem(TOKEN_KEY);
export const saveSession = (value: string) =>
  localStorage.setItem(TOKEN_KEY, value);
export const clearSession = () => localStorage.removeItem(TOKEN_KEY);
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  try {
    const r = await fetch(BASE + path, {
      ...options,
      headers: {
        ...(options.headers || {}),
        ...(token() ? { Authorization: "Bearer " + token() } : {}),
      },
    });
    if (!r.ok) {
      const body = await r.json().catch(() => null);
      throw new Error(
        body?.detail || "Não foi possível concluir esta operação.",
      );
    }
    return r.json() as Promise<T>;
  } catch (error) {
    if (error instanceof TypeError)
      throw new Error(
        "Não foi possível conectar à AXION local. Confirme se o backend está iniciado na porta 8000.",
      );
    throw error;
  }
}
export type ApiWorkspace = {
  id: string;
  name: string;
  type: "institution";
  owner_id: string;
  created_at: string;
};
export type ApiFile = {
  id: string;
  name: string;
  type: string;
  size: number;
  status: string;
  created_at: string;
  workspace_id: string;
};
export type ApiExecution = {
  id: string;
  command: string;
  workspace_id: string;
  status: string;
  intent: string;
  plan: string[];
  questions: string[];
  used_files: { id: string; name: string }[];
  used_tools: string[];
  approval_required: boolean;
  result: any;
  created_at: string;
  updated_at: string;
};
export const getWorkspaces = () => request<ApiWorkspace[]>("/api/workspaces");
export const getFiles = (workspaceId: string) =>
  request<ApiFile[]>(
    `/api/files?workspace_id=${encodeURIComponent(workspaceId)}`,
  );
export async function uploadFiles(
  files: File[],
  workspaceId: string,
): Promise<ApiFile[]> {
  const form = new FormData();
  files.forEach((x) => form.append("files", x));
  const result = await request<ApiFile | { files: ApiFile[] }>(
    `/api/files/upload?workspace_id=${encodeURIComponent(workspaceId)}`,
    { method: "POST", body: form },
  );
  return "files" in result ? result.files : [result];
}
export const createExecution = (
  command: string,
  fileIds: string[],
  workspaceId: string,
) =>
  request<ApiExecution>("/api/executions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      command,
      file_ids: fileIds,
      workspace_id: workspaceId,
    }),
  });
export const getExecution = (id: string) =>
  request<ApiExecution>("/api/executions/" + id);
export const getExecutionHistory = (workspaceId: string) =>
  request<ApiExecution[]>(
    `/api/executions?workspace_id=${encodeURIComponent(workspaceId)}`,
  );
export const clarifyExecution = (
  id: string,
  answers: Record<string, string>,
  fileIds: string[] = [],
) =>
  request<ApiExecution>("/api/executions/" + id + "/clarify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers, file_ids: fileIds }),
  });
export const approveExecution = (id: string) =>
  request<ApiExecution>("/api/executions/" + id + "/approve", {
    method: "POST",
  });
export const runExecution = (id: string) =>
  request<ApiExecution>("/api/executions/" + id + "/run", { method: "POST" });
export const cancelExecution = (id: string) =>
  request<ApiExecution>("/api/executions/" + id + "/cancel", {
    method: "POST",
  });
export type ApiMember = {
  id: string;
  workspace_id: string;
  user_id: string | null;
  name: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  permissions: string[];
};
export type ApiIndicators = {
  members_total: number;
  members_active: number;
  executions_total: number;
  executions_completed: number;
  executions_running: number;
  files_processed: number;
  last_activity: string | null;
};
export type ApiPlan = {
  plan: string;
  status: string;
  limits: {
    members: number | null;
    executions: number | null;
    storage_mb: number | null;
  };
  usage: { members: number; executions: number; storage_mb: number };
};
export type ApiUser = {
  id: string;
  name: string | null;
  email: string | null;
  account_type: string;
  created_at: string;
  current_workspace_id: string | null;
};
export const getCurrentUser = () => request<ApiUser>("/api/me");
export const listMembers = (workspaceId: string) =>
  request<ApiMember[]>(`/api/workspaces/${workspaceId}/members`);
export const inviteMember = (
  workspaceId: string,
  data: { name: string; email: string; role: string },
) =>
  request<ApiMember>(`/api/workspaces/${workspaceId}/members/invite`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
export const updateMember = (
  workspaceId: string,
  memberId: string,
  data: { role?: string; status?: string },
) =>
  request<ApiMember>(`/api/workspaces/${workspaceId}/members/${memberId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
export const removeMember = (workspaceId: string, memberId: string) =>
  request<{ status: string }>(
    `/api/workspaces/${workspaceId}/members/${memberId}`,
    { method: "DELETE" },
  );
export const getWorkspaceIndicators = (workspaceId: string) =>
  request<ApiIndicators>(`/api/workspaces/${workspaceId}/indicators`);
export const getWorkspacePlan = (workspaceId: string) =>
  request<ApiPlan>(`/api/workspaces/${workspaceId}/plan`);

export const updateMemberPermissions = (
  workspaceId: string,
  memberId: string,
  permissions: string[],
) =>
  request<{ workspace_id: string; member_id: string; permissions: string[] }>(
    "/api/workspaces/" + workspaceId + "/members/" + memberId + "/permissions",
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ permissions }),
    },
  );

export const login = (email: string, password: string) =>
  request<{ token: string }>("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
export const register = (name: string, email: string, password: string, accountType: "individual" | "institution", institutionName?: string) =>
  request<{ token: string }>("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password, account_type: accountType, institution_name: institutionName }),
  });
export const logout = () => request("/api/auth/logout", { method: "POST" });

