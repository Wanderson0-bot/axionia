import { useEffect, useState } from "react";
import {
  getCurrentUser,
  getWorkspaceIndicators,
  getWorkspacePlan,
  listMembers,
  type ApiIndicators,
  type ApiMember,
  type ApiPlan,
  type ApiUser,
} from "../services/api";
export function useCurrentUser() {
  const [data, setData] = useState<ApiUser | null>(null);
  useEffect(() => {
    getCurrentUser()
      .then(setData)
      .catch(() => setData(null));
  }, []);
  return data;
}
export function useInstitutionData(workspaceId: string, enabled: boolean) {
  const [members, setMembers] = useState<ApiMember[]>([]);
  const [indicators, setIndicators] = useState<ApiIndicators | null>(null);
  const [plan, setPlan] = useState<ApiPlan | null>(null);
  const refresh = () => {
    if (!enabled) return;
    listMembers(workspaceId)
      .then(setMembers)
      .catch(() => setMembers([]));
    getWorkspaceIndicators(workspaceId)
      .then(setIndicators)
      .catch(() => setIndicators(null));
    getWorkspacePlan(workspaceId)
      .then(setPlan)
      .catch(() => setPlan(null));
  };
  useEffect(refresh, [workspaceId, enabled]);
  return { members, indicators, plan, refresh };
}
