"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

async function getWorkspaceId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("workspaces")
    .select("id")
    .eq("owner_id", user.id)
    .limit(1)
    .single();
  return data?.id || null;
}

async function getCompanyId(workspaceId: string): Promise<string | null> {
  const { data } = await supabase
    .from("companies")
    .select("id")
    .eq("workspace_id", workspaceId)
    .limit(1)
    .single();
  return data?.id || null;
}

export type InstalledPlaybookRow = {
  id: string;
  company_id: string;
  playbook_id: string;
  customization: Record<string, unknown>;
  active: boolean;
  schedule: string | null;
  last_run_at: string | null;
  run_count: number;
  installed_at: string;
  playbook?: {
    name: string;
    description: string | null;
    category: string;
  };
};

export function useInstalledPlaybooks() {
  return useQuery({
    queryKey: ["installed-playbooks"],
    queryFn: async (): Promise<InstalledPlaybookRow[]> => {
      const wsId = await getWorkspaceId();
      if (!wsId) return [];
      const companyId = await getCompanyId(wsId);
      if (!companyId) return [];

      const { data } = await supabase
        .from("installed_playbooks")
        .select("*, playbooks(name, description, category)")
        .eq("company_id", companyId)
        .order("installed_at", { ascending: false });

      return (data || []).map((row: Record<string, unknown>) => ({
        ...row,
        playbook: row.playbooks as InstalledPlaybookRow["playbook"],
      })) as InstalledPlaybookRow[];
    },
  });
}

export type PlaybookRunResult = {
  run_id: string;
  installed_playbook_id: string;
  playbook_name: string;
  tasks_created: number;
  steps: Array<{ order: number; action: string; taskId: string }>;
};

export function useRunPlaybook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (installedId: string): Promise<PlaybookRunResult> => {
      const res = await fetch(`/api/v1/installed-playbooks/${installedId}/run`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to run playbook");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["installed-playbooks"] });
      queryClient.invalidateQueries({ queryKey: ["playbook-actions"] });
    },
  });
}

export type ActionRow = {
  id: string;
  company_id: string;
  installed_playbook_id: string | null;
  task_id: string | null;
  action_type: string;
  description: string | null;
  success: boolean;
  evidence: Record<string, unknown>;
  cost: number;
  duration_ms: number | null;
  created_at: string;
};

export function usePlaybookActions(installedPlaybookId: string | null, playbookRunId?: string) {
  return useQuery({
    queryKey: ["playbook-actions", installedPlaybookId, playbookRunId],
    enabled: !!installedPlaybookId,
    queryFn: async (): Promise<ActionRow[]> => {
      const wsId = await getWorkspaceId();
      if (!wsId) return [];
      const companyId = await getCompanyId(wsId);
      if (!companyId) return [];

      let url = `/api/v1/actions?company_id=${companyId}&installed_playbook_id=${installedPlaybookId}`;
      if (playbookRunId) url += `&playbook_run_id=${playbookRunId}`;

      const res = await fetch(url);
      const data = await res.json();
      return data.actions || [];
    },
    refetchInterval: 10_000,
  });
}

export type NotificationRow = {
  id: string;
  user_id: string;
  task_id: string | null;
  channel: string;
  status: string;
  message: string | null;
  error: string | null;
  external_id: string | null;
  sent_at: string | null;
  created_at: string;
};

export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: async (): Promise<NotificationRow[]> => {
      const res = await fetch("/api/v1/notifications?limit=50");
      const data = await res.json();
      return data.notifications || [];
    },
    refetchInterval: 30_000,
  });
}
