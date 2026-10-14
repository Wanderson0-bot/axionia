export type AccountType = "individual" | "institution";
export type AccountRole = "owner" | "admin" | "member";
export type ExecutionStatus =
  | "pending_clarification"
  | "awaiting_approval"
  | "approved"
  | "running"
  | "completed"
  | "cancelled"
  | "failed";
export type DisplayExecutionStatus =
  "completed" | "running" | "approval" | "attention" | "cancelled";
export interface UserAccount {
  id: string;
  name: string;
  email: string;
  accountType: AccountType;
  institutionId?: string;
  role?: AccountRole;
  area?: string;
  plan: string;
}
export interface Institution {
  id: string;
  name: string;
  type: string;
  document?: string;
  ownerId: string;
  memberCount: number;
  plan: string;
  status: "active" | "trial" | "inactive";
  city: string;
}
export interface InstitutionMember {
  id: string;
  name: string;
  email: string;
  role: "admin" | "member";
  status: "active" | "pending";
  active: boolean;
  usage: number;
}
export interface AttachedFile {
  id: string;
  name: string;
  type: string;
  size: string;
  file?: File;
  status: "Pronto" | "Processando";
}
export interface ExecutionStep {
  title: string;
  description: string;
  time: string;
  state: "done" | "active" | "pending";
}
export interface ToolRun {
  name: string;
  status: "done" | "active" | "pending";
  duration: string;
  summary: string;
}
export interface ExecutionResult {
  headline: string;
  emphasis: string;
  description: string;
  stats: { label: string; value: string; detail: string }[];
  table: { headers: string[]; rows: string[][] };
  recommendations: string[];
  warnings?: string[];
  sources?: { name?: string; url?: string; type?: string }[];
  outputFiles?: { name?: string; url?: string; type?: string; size?: number }[];
}
export interface Execution {
  id: string;
  workspaceId: string;
  title: string;
  type: string;
  date: string;
  status: ExecutionStatus;
  files: AttachedFile[];
  duration: string;
  command: string;
  steps: ExecutionStep[];
  tools: ToolRun[];
  result: ExecutionResult;
  requiresApproval: boolean;
  questions?: string[];
  createdAt: string;
  author?: string;
}
export interface FileItem extends AttachedFile {
  date: string;
  executions: number;
}
export interface User {
  name: string;
  email: string;
  organization: string;
  plan: string;
}
