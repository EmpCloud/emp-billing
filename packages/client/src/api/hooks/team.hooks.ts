import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPut, apiDelete } from "../client";
import toast from "react-hot-toast";

const TEAM_MEMBERS_KEY = "team-members";

export function useTeamMembers() {
  return useQuery({
    queryKey: [TEAM_MEMBERS_KEY],
    queryFn: () => apiGet("/organizations/members"),
  });
}

export function useInviteMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiPost("/organizations/members", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [TEAM_MEMBERS_KEY] });
      toast.success("Member invited");
    },
    onError: () => toast.error("Failed to invite member"),
  });
}

export function useUpdateMemberRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      apiPut(`/organizations/members/${userId}/role`, { role }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [TEAM_MEMBERS_KEY] });
      toast.success("Role updated");
    },
    onError: () => toast.error("Failed to update role"),
  });
}

export function useRemoveMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      apiDelete(`/organizations/members/${userId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [TEAM_MEMBERS_KEY] });
      toast.success("Member removed");
    },
    onError: () => toast.error("Failed to remove member"),
  });
}
