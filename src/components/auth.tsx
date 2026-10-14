import { useState } from "react";
import { Eye, EyeOff, LockKeyhole, Mail, Cloud, HelpCircle } from "lucide-react";
import { Button } from "./ui";
import { useAuth } from "../hooks/useAuth";

export function AuthScreen() {
  const { state, error, login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [accountType, setAccountType] = useState<"individual" | "institution">("individual");
  const [institutionName, setInstitutionName] = useState("");
  const [visible, setVisible] = useState(false);
  const [localError, setLocalError] = useState("");
  const [notice, setNotice] = useState("");
  const busy = state === "logging_in" || state === "registering";
  const submit = async () => {
    setLocalError(""); setNotice("");
    if (!/^\S+@\S+\.\S+$/.test(email)) return setLocalError("Informe um e-mail válido.");
    if (mode === "register") {
      if (!name.trim()) return setLocalError("Informe seu nome.");
      if (password.length < 8) return setLocalError("A senha deve ter ao menos 8 caracteres.");
      if (password !== confirmation) return setLocalError("As senhas não coincidem.");
      if (accountType === "institution" && !institutionName.trim()) return setLocalError("Informe o nome da instituição.");
      await register(name.trim(), email.trim(), password, accountType, institutionName.trim() || undefined);
      return;
    }
    if (!password) return setLocalError("Informe sua senha.");
    await login(email.trim(), password);
  };
  return <main className="auth-page">
    <div className="auth-orbit auth-orbit-one" /><div className="auth-orbit auth-orbit-two" />
    <section className="auth-content" aria-labelledby="auth-title">
      <img className="auth-symbol" src="/Simbolo%20Isolado%20Branco.png" alt="AXION IA" />
      <h1 id="auth-title">{mode === "login" ? "Entre na AXION IA" : "Crie sua conta"}</h1>
      <p className="auth-subtitle">{mode === "login" ? "Sua inteligência operacional começa aqui." : "Crie seu espaço operacional seguro."}</p>
      <div className="auth-card">
        {mode === "login" && <><button className="google-button" type="button" onClick={() => setNotice("Login com Google ainda não está configurado.")}><svg className="google-icon" aria-hidden="true" viewBox="0 0 24 24"><path fill="#4285F4" d="M21.35 12.27c0-.79-.07-1.55-.2-2.27H12v4.3h5.23a4.47 4.47 0 0 1-1.94 2.93v2.79h3.59c2.1-1.93 3.31-4.78 3.31-8.15Z"/><path fill="#34A853" d="M12 21.73c2.7 0 4.96-.9 6.62-2.43l-3.59-2.79c-1 .67-2.27 1.07-3.73 1.07-2.87 0-5.3-1.94-6.17-4.54H1.43v2.88A9.99 9.99 0 0 0 12 21.73Z"/><path fill="#FBBC05" d="M5.13 13.04A5.98 5.98 0 0 1 4.8 12c0-.36.06-.7.16-1.04V8.08H1.43A9.99 9.99 0 0 0 1.43 15.92l3.7-2.88Z"/><path fill="#EA4335" d="M12 6.42c1.56 0 2.96.54 4.06 1.6l3.04-3.04C16.95 2.97 14.7 1.73 12 1.73A9.99 9.99 0 0 0 1.43 8.08l3.7 2.88C6 8.36 8.43 6.42 12 6.42Z"/></svg>Continuar com o Google</button><div className="auth-divider"><span>ou</span></div></>}
        {mode === "register" && <label className="auth-field"><span>Nome</span><div><input autoComplete="name" value={name} onChange={e => setName(e.target.value)} placeholder="Como podemos chamar você?" /></div></label>}{mode === "register" && <><div className="account-type"><button type="button" className={accountType === "individual" ? "selected" : ""} onClick={() => setAccountType("individual")}>Individual</button><button type="button" className={accountType === "institution" ? "selected" : ""} onClick={() => setAccountType("institution")}>Institucional</button></div>{accountType === "institution" && <label className="auth-field"><span>Instituição</span><div><input value={institutionName} onChange={e => setInstitutionName(e.target.value)} placeholder="Nome da instituição" /></div></label>}</>}
        <label className="auth-field"><span>E-mail</span><div><Mail size={18}/><input autoComplete="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Digite seu e-mail" /></div></label>
        <label className="auth-field"><span>Senha</span><div><LockKeyhole size={18}/><input autoComplete={mode === "login" ? "current-password" : "new-password"} type={visible ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Digite sua senha" /><button type="button" aria-label={visible ? "Ocultar senha" : "Mostrar senha"} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></label>
        {mode === "register" && <label className="auth-field"><span>Confirmar senha</span><div><LockKeyhole size={18}/><input autoComplete="new-password" type={visible ? "text" : "password"} value={confirmation} onChange={e => setConfirmation(e.target.value)} placeholder="Repita sua senha" /></div></label>}
        {mode === "login" && <button className="auth-link forgot" type="button" onClick={() => setNotice("A recuperação de senha ainda não está configurada.")}>Esqueceu sua senha?</button>}
        {(localError || error) && <p className="auth-error">{localError || error}</p>}{notice && <p className="auth-notice">{notice}</p>}
        <Button disabled={busy} onClick={submit}>{busy ? "Verificando…" : mode === "login" ? "Entrar" : "Criar conta"}</Button>
        <p className="auth-switch">{mode === "login" ? "Não tem uma conta?" : "Já tem uma conta?"} <button type="button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setLocalError(""); setNotice(""); }}>{mode === "login" ? "Criar uma conta" : "Entrar"}</button></p>
      </div>
      {mode === "login" && <><div className="auth-backup"><Cloud size={20}/><div><strong>Já tem seus arquivos de backup prontos?</strong><button type="button" onClick={() => setNotice("A restauração de conta ainda não está configurada.")}>Restaurar conta</button></div></div><p className="auth-support"><HelpCircle size={15}/> Não consegue encontrar seu método de login? <button type="button" onClick={() => setNotice("O suporte ainda não está configurado.")}>Entre em contato com o suporte</button></p></>}
      <footer>Ao continuar, você concorda com nossos <a href="#terms">Termos de Serviço</a> e confirma que leu nossa <a href="#privacy">Política de Privacidade</a>.</footer>
    </section>
  </main>;
}


