 import { NavLink } from "react-router-dom";
import {
  Activity,
  History,
  FolderOpen,
  Settings,
  Plus,
  Menu,
  X,
  ChevronDown, Sun, Moon,
  Users,
  Building2,
  BarChart3,
  LayoutGrid,
  CreditCard,
} from "lucide-react";
import { useState } from "react";
import type { UserAccount } from "../types";
const individualNav = [
  ["/", "Nova execução", Plus],
  ["/history", "Histórico", History],
  ["/files", "Meus arquivos", FolderOpen],
  ["/results", "Resultados", BarChart3],
  ["/settings", "Configurações", Settings],
  ["/plan", "Plano", CreditCard],
] as const;
const institutionNav = [
  ["/", "Nova execução", Plus],
  ["/history", "Histórico", History],
  ["/files", "Arquivos", FolderOpen],
  ["/workspace", "Workspace", LayoutGrid],
  ["/members", "Membros", Users],
  ["/activity", "Atividade", BarChart3],
  ["/reports", "Relatórios", FolderOpen],
  ["/settings", "Configurações", Settings],
  ["/plan", "Plano institucional", CreditCard],
] as const;
export function AppShell({
  children,
  account,
  onLogout,
}: {
  children: React.ReactNode;
  account: UserAccount;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem("axion-theme");
    const next = saved === "dark";
    document.documentElement.dataset.theme = next ? "dark" : "light";
    return next;
  });
  const toggleTheme = () => setDark((value) => {
    const next = !value;
    document.documentElement.dataset.theme = next ? "dark" : "light";
    localStorage.setItem("axion-theme", next ? "dark" : "light");
    return next;
  });
  const nav =
    account.accountType === "institution" ? institutionNav : individualNav;
  const label = account.plan || "Não disponível";
  return (
    <div className="app">
      <aside className={open ? "sidebar open" : "sidebar"}>
        <div className="brand brand-sidebar">
          <img
            className="sidebar-logo"
            src="/Simbolo%20Isolado%20Branco.png"
            alt="AXION IA"
          />
          <button className="close" onClick={() => setOpen(false)}>
            <X />
          </button>
        </div>
        <nav>
          {nav.map(([path, name, Icon]) => (
            <NavLink
              onClick={() => setOpen(false)}
              to={path}
              key={path}
              end={path === "/"}
            >
              <Icon size={18} />
              <span>{name}</span>
            </NavLink>
          ))}
        </nav>
        <div className="side-bottom">
          <button className="theme-toggle" onClick={toggleTheme}>{dark ? <Sun size={16}/> : <Moon size={16}/>} {dark ? "Tema claro" : "Tema escuro"}</button>
          <div className="plan">
            {label}
            <span>Ativo</span>
          </div>
          <button className="profile" onClick={onLogout}>
            <span className="avatar">
              {account.name
                .split(" ")
                .map((x) => x[0])
                .slice(0, 2)
                .join("")}
            </span>
            <span>
              <b>{account.name}</b>
              <small>
                {account.accountType === "institution"
                  ? "Ambiente institucional"
                  : "Conta individual"}
              </small>
            </span>
            <small>Sair</small>
          </button>
        </div>
      </aside>
      <header className="mobile-head">
        <button onClick={() => setOpen(true)}>
          <Menu />
        </button>
        <div className="brand">
          <span className="mark">
            <img
              className="mobile-logo"
              src="/Símbolo%20isolado.png"
              alt="AXION IA"
            />
          </span>
          AXION <b>IA</b>
        </div>
        <span className="avatar">
          {account.name
            .split(" ")
            .map((x) => x[0])
            .slice(0, 2)
            .join("")}
        </span>
      </header>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <main>{children}</main>
    </div>
  );
}

