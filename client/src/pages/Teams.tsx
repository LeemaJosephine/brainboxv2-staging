import { useState } from "react";
import { Link } from "react-router-dom";
import { LayoutGrid, KeyRound, Plus, Loader2, Building2, Hash, Pencil, Trash2, Users, X } from "lucide-react";
import { useAppSelector } from "../app/hooks";
import {
  useGetMembersQuery,
  useListTeamsQuery,
  useGetTeamMembersByTeamIdQuery,
  useCreateTeamMutation,
  useUpdateTeamMutation,
  useDeleteTeamMutation,
} from "../services/teamApi";
import { useUpdateUserRoleAndTeamMutation } from "../services/usersApi";
import type { TeamInfo } from "../services/teamApi";

const inputClass =
  "w-full rounded border border-slate-500 bg-slate-700/50 px-3 py-2 text-white placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none";

function MembersModal({ teamId, onClose }: { teamId: string; onClose: () => void }) {
  const { data, isLoading, error, isFetching, refetch } = useGetTeamMembersByTeamIdQuery(teamId);
  const [updateUserRoleAndTeam, { isLoading: updatingRole }] = useUpdateUserRoleAndTeamMutation();
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);

  const team = data?.team;
  const members = data?.members ?? [];

  const sortedMembers = [...members].sort((a, b) => {
    const aIsManager = a.role === "admin" && a.status === "active";
    const bIsManager = b.role === "admin" && b.status === "active";
    if (aIsManager && !bIsManager) return -1;
    if (!aIsManager && bIsManager) return 1;
    const aIsActive = a.status === "active";
    const bIsActive = b.status === "active";
    if (aIsActive && !bIsActive) return -1;
    if (!aIsActive && bIsActive) return 1;
    return a.createdAt.localeCompare(b.createdAt);
  });

  const activeMembers = sortedMembers.filter((m) => m.status === "active");
  const onlyActiveMemberId = activeMembers.length === 1 ? activeMembers[0].userId : null;

  const isBusy = isLoading || isFetching || updatingRole;

  const handleChangeRole = async (memberId: string, userId: string, currentOrgRole: string, nextAppRole: "team_manager" | "user") => {
    const currentAppRole: "team_manager" | "user" = currentOrgRole === "admin" ? "team_manager" : "user";
    if (currentAppRole === nextAppRole) return;

    if (currentOrgRole === "admin" && nextAppRole === "user" && activeMembers.length > 1) {
      setRoleError("Please assign another member as Team Manager first. Exactly one Team Manager is required per team.");
      return;
    }

    if (!team?._id) return;

    setRoleError(null);
    setUpdatingUserId(userId);
    try {
      await updateUserRoleAndTeam({
        userId,
        role: nextAppRole,
        teamId: team._id,
      }).unwrap();
      await refetch();
    } catch (err) {
      const maybeError = err as { data?: { message?: string } };
      const msg = maybeError?.data?.message || "Failed to update role. Please try again.";
      setRoleError(msg);
    } finally {
      setUpdatingUserId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-xl border border-slate-600 bg-slate-800 shadow-xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
          <h3 className="text-lg font-semibold text-white">
            {team ? `${team.name} — Members` : "Team members"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded text-slate-400 hover:bg-slate-600 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto flex-1">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
            </div>
          )}
          {error && (
            <p className="text-red-400 text-sm">
              {"data" in error && typeof (error.data as { message?: string }).message === "string"
                ? (error.data as { message: string }).message
                : "Failed to load members"}
            </p>
          )}
          {!isLoading && !error && sortedMembers.length > 0 && (
            <>
              <p className="text-slate-400 text-xs mb-3">
                Exactly one member in each team can be a <span className="text-slate-200 font-semibold">Team Manager</span>.{" "}
                When you switch someone to Team Manager, the previous manager is set back to User automatically.
              </p>
              {roleError && <p className="text-xs text-red-400 mb-2">{roleError}</p>}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="bg-slate-700/50 border-b border-slate-600">
                      <th className="text-left text-slate-300 font-medium px-4 py-3">Name</th>
                      <th className="text-left text-slate-300 font-medium px-4 py-3">Email</th>
                      <th className="text-left text-slate-300 font-medium px-4 py-3">Role</th>
                      <th className="text-left text-slate-300 font-medium px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedMembers.map((m) => (
                      <tr key={m._id} className="border-b border-slate-600/80 last:border-b-0 hover:bg-slate-700/30">
                        <td className="px-4 py-3 text-white font-medium">{m.name}</td>
                        <td className="px-4 py-3 text-slate-400">{m.email}</td>
                        <td className="px-4 py-3">
                          {m.status !== "active" ? (
                            <span className="text-slate-400 text-xs">User (pending)</span>
                          ) : onlyActiveMemberId === m.userId ? (
                            <div className="flex flex-col gap-1">
                              <span className="inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
                                Team Manager
                              </span>
                              <span className="text-[11px] text-slate-400">
                                Only active member in this team · cannot change
                              </span>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-1">
                              <select
                                value={m.role === "admin" ? "team_manager" : "user"}
                                onChange={(e) =>
                                  handleChangeRole(
                                    m._id,
                                    m.userId,
                                    m.role,
                                    e.target.value as "team_manager" | "user"
                                  )
                                }
                                disabled={isBusy || updatingUserId === m.userId}
                                className="w-40 rounded-md border border-slate-600 bg-slate-800/80 px-2 py-1 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                              >
                                <option value="user">User</option>
                                <option value="team_manager">Team Manager</option>
                              </select>
                              {updatingUserId === m.userId && (
                                <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  Updating role…
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={m.status === "active" ? "text-emerald-400" : "text-amber-400"}>{m.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {!isLoading && !error && sortedMembers.length === 0 && (
            <p className="text-slate-400 text-sm py-4">No members yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Teams() {
  const { user, membership } = useAppSelector((state) => state.auth);
  const isPlatformAdmin = user?.role === "admin";
  const { data: membersData, isLoading: membersLoading } = useGetMembersQuery(undefined, {
    skip: isPlatformAdmin,
  });
  const { data: teamsData, isLoading: teamsLoading } = useListTeamsQuery(undefined, {
    skip: !isPlatformAdmin,
  });
  const [createTeam, { isLoading: creating, error: createError }] = useCreateTeamMutation();
  const [updateTeam, { isLoading: updating }] = useUpdateTeamMutation();
  const [deleteTeam, { isLoading: deleting }] = useDeleteTeamMutation();
  const [teamName, setTeamName] = useState("");
  const [editingTeam, setEditingTeam] = useState<TeamInfo | null>(null);
  const [editName, setEditName] = useState("");
  const [deletingTeam, setDeletingTeam] = useState<TeamInfo | null>(null);
  const [membersModalTeamId, setMembersModalTeamId] = useState<string | null>(null);

  const hasActiveTeam = membership?.status === "active";
  const team = membersData?.team;
  const adminTeams = teamsData?.teams ?? [];

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) return;
    try {
      await createTeam({ name: teamName.trim() }).unwrap();
      setTeamName("");
    } catch {
      // Error from mutation
    }
  };

  const handleStartEdit = (t: TeamInfo) => {
    setEditingTeam(t);
    setEditName(t.name);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeam || !editName.trim()) return;
    try {
      await updateTeam({ teamId: editingTeam._id, name: editName.trim() }).unwrap();
      setEditingTeam(null);
      setEditName("");
    } catch {
      // Error from mutation
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingTeam) return;
    try {
      await deleteTeam(deletingTeam._id).unwrap();
      setDeletingTeam(null);
    } catch {
      // Error from mutation
    }
  };

  const createErr =
    createError && "data" in createError &&
    typeof (createError.data as { message?: string }).message === "string"
      ? (createError.data as { message: string }).message
      : null;

  if ((membersLoading && hasActiveTeam) || (isPlatformAdmin && teamsLoading && adminTeams.length === 0)) {
    return (
      <div className="w-full min-w-0 px-3 py-4 sm:px-4 flex items-center justify-center min-h-[280px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 px-3 py-4 sm:px-4">
      <h1 className="text-2xl font-bold text-white flex items-center gap-2 mb-4 sm:mb-6">
        <LayoutGrid className="h-7 w-7 text-slate-400" />
        Teams
      </h1>

      {hasActiveTeam && team ? (
        <div className="rounded-xl border border-slate-600 bg-slate-800/60 backdrop-blur p-6 mb-6">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
            <Building2 className="h-5 w-5 text-slate-400" />
            Your team
          </h2>
          <div className="grid gap-3 text-sm text-slate-200">
            <div className="flex items-center gap-3">
              <span className="text-slate-400 w-32 shrink-0">Name</span>
              <span className="font-medium text-white">{team.name}</span>
            </div>
            <div className="flex items-center gap-3">
              <Hash className="h-5 w-5 text-slate-400 shrink-0" />
              <span className="text-slate-400 w-32 shrink-0">Team ID</span>
              <span className="font-mono text-slate-300 bg-slate-700/50 px-2 py-1 rounded">{team.teamCode}</span>
            </div>
          </div>
          <p className="text-slate-400 text-sm mt-3">
            Share the Team ID with others so they can request to join. As team manager you can approve them in Members.
          </p>
        </div>
      ) : null}

      {isPlatformAdmin && (
        <>
          <div className="rounded-xl border border-slate-600 bg-slate-800/60 backdrop-blur p-6 mb-6">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-2">
              <Plus className="h-5 w-5 text-slate-400" />
              Create a team
            </h2>
            <p className="text-slate-400 text-sm mb-4">
              As platform admin you can create as many teams as you need. You are not a member of any team; the first person to join with the Team ID becomes the team manager.
            </p>
            <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-4">
              <div className="flex-1 min-w-[200px] max-w-md">
                <label htmlFor="teamName" className="block text-sm font-medium text-slate-300 mb-1">Team name</label>
                <input
                  id="teamName"
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. Engineering"
                  required
                />
              </div>
              {createErr && <p className="text-sm text-red-400 w-full">{createErr}</p>}
              <button
                type="submit"
                disabled={creating}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition-colors shrink-0"
              >
                {creating ? "Creating..." : "Create team"}
              </button>
            </form>
          </div>

          {adminTeams.length > 0 && (
            <div className="rounded-xl border border-slate-600 bg-slate-800/60 backdrop-blur p-6">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                <Building2 className="h-5 w-5 text-slate-400" />
                Teams you created
              </h2>
              <p className="text-slate-400 text-sm mb-4">
                Share each Team ID with others so they can join. The first person to join becomes the team manager. Click the member count to view the list.
              </p>
              <div className="rounded-lg border border-slate-600 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-700/50 border-b border-slate-600">
                      <th className="text-left text-slate-300 font-medium px-4 py-3">Team</th>
                      <th className="text-left text-slate-300 font-medium px-4 py-3">Manager</th>
                      <th className="text-left text-slate-300 font-medium px-4 py-3">Team ID</th>
                      <th className="text-center text-slate-300 font-medium px-4 py-3">Members</th>
                      <th className="text-right text-slate-300 font-medium px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminTeams.map((t) => (
                      <tr key={t._id} className="border-b border-slate-600/80 last:border-b-0 hover:bg-slate-700/30">
                        <td className="px-4 py-3 text-white font-medium">{t.name}</td>
                        <td className="px-4 py-3 text-slate-400">{t.teamManagerName ?? "—"}</td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-slate-300 bg-slate-700/50 px-2 py-1 rounded text-xs">{t.teamCode}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => setMembersModalTeamId(t._id)}
                            className="inline-flex items-center justify-center gap-1 rounded px-2 py-1 text-sm font-medium text-blue-400 hover:bg-slate-600 hover:text-white transition-colors"
                            title="View members"
                          >
                            <Users className="h-4 w-4" />
                            <span>{t.memberCount ?? 0}</span>
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleStartEdit(t)}
                              className="p-2 rounded-lg text-slate-400 hover:bg-slate-600 hover:text-white transition-colors"
                              title="Edit team"
                              aria-label="Edit team"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingTeam(t)}
                              className="p-2 rounded-lg text-slate-400 hover:bg-red-600/20 hover:text-red-400 transition-colors"
                              title="Delete team"
                              aria-label="Delete team"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {membersModalTeamId && (
        <MembersModal
          teamId={membersModalTeamId}
          onClose={() => setMembersModalTeamId(null)}
        />
      )}

      {editingTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <form
            onSubmit={handleSaveEdit}
            className="w-full max-w-sm rounded-xl border border-slate-600 bg-slate-800 p-6 shadow-xl"
          >
            <h3 className="text-lg font-semibold text-white mb-4">Edit team</h3>
            <div className="mb-4">
              <label htmlFor="editTeamName" className="block text-sm font-medium text-slate-300 mb-1">
                Team name
              </label>
              <input
                id="editTeamName"
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className={inputClass}
                required
              />
              <p className="text-slate-400 text-xs mt-1">Team ID: {editingTeam.teamCode}</p>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => { setEditingTeam(null); setEditName(""); }}
                className="rounded-lg border border-slate-500 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={updating}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {updating ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}

      {deletingTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-slate-600 bg-slate-800 p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-white mb-2">Delete team?</h3>
            <p className="text-slate-300 text-sm mb-4">
              &quot;{deletingTeam.name}&quot; (ID: {deletingTeam.teamCode}) will be removed. All members will lose access. Quizzes from this team will become global. This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setDeletingTeam(null)}
                className="rounded-lg border border-slate-500 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {!hasActiveTeam && !isPlatformAdmin && (
        <div className="rounded-xl border border-slate-600 bg-slate-800/60 backdrop-blur p-6">
          <p className="text-slate-300 text-sm mb-4">You are not in a team yet. Join using a Team ID from your team manager.</p>
          <Link
            to="/onboarding"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
          >
            <KeyRound className="h-4 w-4" />
            Join a team
          </Link>
        </div>
      )}

    </div>
  );
}
