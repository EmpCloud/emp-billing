import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { InviteUserSchema, UserRole } from "@emp-billing/shared";
import {
  useTeamMembers,
  useInviteMember,
  useUpdateMemberRole,
  useRemoveMember,
} from "@/api/hooks/team.hooks";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/common/Button";
import { Badge } from "@/components/common/Badge";
import { Input, Select } from "@/components/common/Input";
import { Modal } from "@/components/common/Modal";
import { Spinner } from "@/components/common/Spinner";
import { EmptyState } from "@/components/common/EmptyState";
import { Users, UserPlus, Trash2, Shield } from "lucide-react";
import dayjs from "dayjs";
import type { z } from "zod";

type InviteFormValues = z.infer<typeof InviteUserSchema>;

const ROLE_BADGE_VARIANT: Record<string, "purple" | "info" | "success" | "warning" | "gray"> = {
  [UserRole.OWNER]: "purple",
  [UserRole.ADMIN]: "info",
  [UserRole.ACCOUNTANT]: "success",
  [UserRole.SALES]: "warning",
  [UserRole.VIEWER]: "gray",
};

const ROLE_OPTIONS = [
  { value: UserRole.ADMIN, label: "Admin" },
  { value: UserRole.ACCOUNTANT, label: "Accountant" },
  { value: UserRole.SALES, label: "Sales" },
  { value: UserRole.VIEWER, label: "Viewer" },
];

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function TeamPage() {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [roleEditId, setRoleEditId] = useState<string | null>(null);
  const [roleEditValue, setRoleEditValue] = useState<string>("");

  const { data, isLoading } = useTeamMembers();
  const inviteMember = useInviteMember();
  const updateRole = useUpdateMemberRole();
  const removeMember = useRemoveMember();

  const members = (data?.data ?? []) as Record<string, unknown>[];

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InviteFormValues>({
    resolver: zodResolver(InviteUserSchema),
    defaultValues: { role: UserRole.VIEWER },
  });

  function onInviteSubmit(values: InviteFormValues) {
    inviteMember.mutate(values as unknown as Record<string, unknown>, {
      onSuccess: () => {
        setInviteOpen(false);
        reset();
      },
    });
  }

  function handleRoleEdit(userId: string, currentRole: string) {
    setRoleEditId(userId);
    setRoleEditValue(currentRole);
  }

  function handleRoleSave() {
    if (roleEditId && roleEditValue) {
      updateRole.mutate(
        { userId: roleEditId, role: roleEditValue },
        { onSuccess: () => setRoleEditId(null) },
      );
    }
  }

  function handleRemove(userId: string, name: string) {
    if (window.confirm(`Remove ${name} from the team? This cannot be undone.`)) {
      removeMember.mutate(userId);
    }
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Team Members"
        subtitle="Manage your organization's team"
        actions={
          <Button
            icon={<UserPlus className="h-4 w-4" />}
            onClick={() => setInviteOpen(true)}
          >
            Invite Member
          </Button>
        }
      />

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      )}

      {/* Empty */}
      {!isLoading && members.length === 0 && (
        <EmptyState
          icon={<Users className="h-12 w-12" />}
          title="No team members yet"
          description="Invite your first team member to get started."
          action={{ label: "Invite Member", onClick: () => setInviteOpen(true) }}
        />
      )}

      {/* Table */}
      {!isLoading && members.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-500">Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Email</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Role</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Joined</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {members.map((member: any) => (
                <tr key={member.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {member.firstName} {member.lastName}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{member.email}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => handleRoleEdit(member.id, member.role)}
                      className="cursor-pointer"
                      title="Click to change role"
                    >
                      <Badge variant={ROLE_BADGE_VARIANT[member.role] ?? "gray"}>
                        {capitalize(member.role)}
                      </Badge>
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={member.isActive !== false ? "success" : "gray"}>
                      {member.isActive !== false ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {dayjs(member.createdAt).format("DD MMM YYYY")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {member.role !== UserRole.OWNER && (
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Trash2 className="h-4 w-4 text-red-500" />}
                          onClick={() =>
                            handleRemove(member.id, `${member.firstName} ${member.lastName}`)
                          }
                          loading={removeMember.isPending}
                        >
                          <span className="text-red-600">Remove</span>
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Invite Modal */}
      <Modal
        open={inviteOpen}
        onClose={() => {
          setInviteOpen(false);
          reset();
        }}
        title="Invite Team Member"
        size="md"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setInviteOpen(false);
                reset();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit(onInviteSubmit)}
              loading={inviteMember.isPending}
              icon={<UserPlus className="h-4 w-4" />}
            >
              Send Invite
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit(onInviteSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="First Name"
              required
              placeholder="John"
              error={errors.firstName?.message}
              {...register("firstName")}
            />
            <Input
              label="Last Name"
              required
              placeholder="Doe"
              error={errors.lastName?.message}
              {...register("lastName")}
            />
          </div>
          <Input
            label="Email"
            type="email"
            required
            placeholder="john@example.com"
            error={errors.email?.message}
            {...register("email")}
          />
          <Select
            label="Role"
            required
            error={errors.role?.message}
            {...register("role")}
          >
            {ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </form>
      </Modal>

      {/* Role Edit Modal */}
      <Modal
        open={roleEditId !== null}
        onClose={() => setRoleEditId(null)}
        title="Change Member Role"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setRoleEditId(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleRoleSave}
              loading={updateRole.isPending}
              icon={<Shield className="h-4 w-4" />}
            >
              Update Role
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Select a new role for this team member.
          </p>
          <Select
            label="Role"
            value={roleEditValue}
            onChange={(e) => setRoleEditValue(e.target.value)}
          >
            {ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
      </Modal>
    </div>
  );
}
