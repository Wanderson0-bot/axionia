import { useEffect, useState } from "react";
import { getWorkspaces, type ApiWorkspace } from "../services/api";
const KEY = "axion-workspace-id";
export function useWorkspaces() {
  const [workspaces, setWorkspaces] = useState<ApiWorkspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState(
    localStorage.getItem(KEY) || "",
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    getWorkspaces()
      .then((items) => {
        const institutions = items.filter((x) => x.type === "institution");
        setWorkspaces(institutions);
        setWorkspaceId((current) =>
          institutions.some((x) => x.id === current)
            ? current
            : institutions[0]?.id || "",
        );
      })
      .catch((e) =>
        setError(
          e instanceof Error
            ? e.message
            : "Não foi possível carregar workspaces.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (workspaceId) localStorage.setItem(KEY, workspaceId);
    else localStorage.removeItem(KEY);
  }, [workspaceId]);
  return {
    workspaces,
    workspaceId,
    setWorkspaceId,
    workspace: workspaces.find((x) => x.id === workspaceId),
    loading,
    error,
  };
}
