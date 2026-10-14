import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  clearSession,
  getCurrentUser,
  login as apiLogin,
  logout as apiLogout,
  register as apiRegister,
  saveSession,
  type ApiUser,
} from "../services/api";
type State =
  | "checking_session"
  | "unauthenticated"
  | "authenticated"
  | "logging_in"
  | "registering"
  | "logging_out"
  | "error";
type Auth = {
  user: ApiUser | null;
  state: State;
  error: string;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, accountType: "individual" | "institution", institutionName?: string) => Promise<void>;
  logout: () => Promise<void>;
};
const Context = createContext<Auth | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null),
    [state, setState] = useState<State>("checking_session"),
    [error, setError] = useState("");
  useEffect(() => {
    if (!localStorage.getItem("axion-session-token")) {
      setState("unauthenticated");
      return;
    }
    getCurrentUser()
      .then((u) => {
        setUser(u);
        setState("authenticated");
      })
      .catch(() => {
        clearSession();
        setState("unauthenticated");
      });
  }, []);
  const authenticate = async (
    action: () => Promise<{ token: string }>,
    busy: State,
  ) => {
    setState(busy);
    setError("");
    try {
      const result = await action();
      saveSession(result.token);
      const me = await getCurrentUser();
      setUser(me);
      setState("authenticated");
    } catch (e) {
      clearSession();
      setError(e instanceof Error ? e.message : "Não foi possível autenticar.");
      setState("unauthenticated");
    }
  };
  return (
    <Context.Provider
      value={{
        user,
        state,
        error,
        login: (email, password) =>
          authenticate(() => apiLogin(email, password), "logging_in"),
        register: (name, email, password, accountType, institutionName) =>
          authenticate(() => apiRegister(name, email, password, accountType, institutionName), "registering"),
        logout: async () => {
          setState("logging_out");
          try {
            await apiLogout();
          } finally {
            clearSession();
            localStorage.removeItem("axion-workspace-id");
            setUser(null);
            setState("unauthenticated");
          }
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useAuth() {
  const value = useContext(Context);
  if (!value) throw new Error("AuthProvider ausente.");
  return value;
}



