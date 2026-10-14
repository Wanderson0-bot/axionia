import type { ReactNode } from "react";
import {
  CheckCircle2,
  Clock3,
  AlertCircle,
  X,
  ChevronDown,
} from "lucide-react";
type BadgeStatus =
  "completed" | "running" | "approval" | "attention" | "cancelled";
export function Button({
  children,
  onClick,
  variant = "primary",
  disabled = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean;
}) {
  return (
    <button disabled={disabled} onClick={onClick} className={"btn " + variant}>
      {children}
    </button>
  );
}
export function StatusBadge({ status }: { status: BadgeStatus }) {
  const map = {
    completed: ["Concluído", CheckCircle2],
    running: ["Executando", Clock3],
    approval: ["Aguardando aprovação", Clock3],
    attention: ["Aguardando esclarecimento", AlertCircle],
    cancelled: ["Cancelado", X],
  } as const;
  const [label, Icon] = map[status];
  return (
    <span className={"status " + status}>
      <Icon size={14} />
      {label}
    </span>
  );
}
export function PageHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
      </div>
      {children}
    </div>
  );
}
export function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="stat">
      <p>{label}</p>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}
export function Toast({
  text,
  onClose,
}: {
  text: string;
  onClose: () => void;
}) {
  return (
    <div className="toast">
      <CheckCircle2 size={18} />
      {text}
      <button onClick={onClose}>
        <X size={16} />
      </button>
    </div>
  );
}
export function Select({
  children,
  onChange,
  value,
}: {
  children: ReactNode;
  onChange?: (value: string) => void;
  value?: string;
}) {
  return (
    <label className="select">
      <select
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
      >
        {children}
      </select>
      <ChevronDown size={15} />
    </label>
  );
}
