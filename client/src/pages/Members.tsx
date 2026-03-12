import { useState } from "react";
import { Link } from "react-router-dom";
import { UserCheck, UserX, Users, Loader2, Shield, ToggleLeft, ToggleRight, UserPlus, Download, FileUp, Pencil, X } from "lucide-react";
import { useAppSelector } from "../app/hooks";
import {
  useGetMembersQuery,
  useListTeamsQuery,
  useApproveMemberMutation,
  useRejectMemberMutation,
} from "../services/teamApi";
import { useGetAllUsersQuery, useSetUserActiveMutation, useUpdateUserRoleAndTeamMutation } from "../services/usersApi";
import type { ApiUser } from "../services/usersApi";
import { useCreateInviteMutation, useCreateBulkInviteMutation } from "../services/inviteApi";
import { parseCsv, csvRowsToMembers } from "../utils/parseCsv";

const inputClass =
  "w-full rounded border border-slate-500 bg-slate-700/50 px-3 py-2 text-white placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none";

export default function Members() {
  const { user } = useAppSelector((state) => state.auth);
  const isPlatformAdmin = user?.role === "admin";

  const { data: allUsersData, isLoading: allUsersLoading, refetch: refetchUsers } = useGetAllUsersQuery(undefined, {
    skip: !isPlatformAdmin,
  });
  const { data: teamsData, refetch: refetchTeams } = useListTeamsQuery(undefined, { skip: !isPlatformAdmin });
  const { data: teamData, isLoading: teamLoading, error: teamError } = useGetMembersQuery(undefined, {
    skip: isPlatformAdmin,
  });
  const [approveMember, { isLoading: approving }] = useApproveMemberMutation();
  const [rejectMember, { isLoading: rejecting }] = useRejectMemberMutation();
  const [setUserActive, { isLoading: toggling }] = useSetUserActiveMutation();
  const [updateUserRoleAndTeam, { isLoading: updatingMember }] = useUpdateUserRoleAndTeamMutation();
  const [createInvite, { isLoading: inviting, error: inviteError }] = useCreateInviteMutation();

  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addTeamId, setAddTeamId] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState(false);

  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvMembers, setCsvMembers] = useState<{ name: string; email: string; teamName?: string }[]>([]);
  const [csvParseError, setCsvParseError] = useState("");
  const [bulkResult, setBulkResult] = useState<{ sent: number; failed: { index: number; email: string; message: string }[] } | null>(null);
  const [addMemberMode, setAddMemberMode] = useState<"one" | "csv">("one");
  const [editingMember, setEditingMember] = useState<ApiUser | null>(null);
  const [editRole, setEditRole] = useState<"team_manager" | "user">("user");
  const [editTeamId, setEditTeamId] = useState("");

  const [createBulkInvite, { isLoading: bulkInviting }] = useCreateBulkInviteMutation();

  const adminTeams = teamsData?.teams ?? [];

  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setCsvFile(file ?? null);
    setBulkResult(null);
    if (!file) {
      setCsvMembers([]);
      setCsvParseError("");
      return;
    }
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setCsvParseError("Please upload a CSV file. Use the sample template for the correct format.");
      setCsvMembers([]);
      return;
    }
    file
      .text()
      .then((text) => {
        const rows = parseCsv(text);
        const parsed = csvRowsToMembers(rows);
        if (parsed.length === 0) {
          setCsvParseError("No valid rows found. CSV must have header: name, email, team name. Team name is required for admin.");
          setCsvMembers([]);
          return;
        }
        setCsvMembers(parsed);
        setCsvParseError("");
      })
      .catch(() => {
        setCsvParseError("Could not read the file.");
        setCsvMembers([]);
      });
  };

  const handleSendBulkInvites = async () => {
    if (csvMembers.length === 0) return;
    setBulkResult(null);
    try {
      const result = await createBulkInvite({ invites: csvMembers }).unwrap();
      setBulkResult({ sent: result.sent, failed: result.failed });
      if (result.sent > 0) {
        setCsvFile(null);
        setCsvMembers([]);
        const input = document.getElementById("members-csv-input") as HTMLInputElement;
        if (input) input.value = "";
      }
    } catch {
      setBulkResult({ sent: 0, failed: [{ index: 0, email: "", message: "Request failed" }] });
    }
  };

  const isLoading = isPlatformAdmin ? allUsersLoading : teamLoading;

  if (isLoading) {
    return (
      <div className="w-full min-w-0 px-3 py-4 sm:px-4 flex items-center justify-center min-h-[280px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
      </div>
    );
  }

  if (isPlatformAdmin) {
    const users = allUsersData?.users ?? [];
    const currentUserId = user?._id;

    const handleSendInvite = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!addName.trim() || !addEmail.trim() || !addTeamId) return;
      setInviteSuccess(false);
      try {
        await createInvite({ name: addName.trim(), email: addEmail.trim().toLowerCase(), teamId: addTeamId }).unwrap();
        setAddName("");
        setAddEmail("");
        setAddTeamId("");
        setInviteSuccess(true);
      } catch {
        // Error from mutation
      }
    };

    const inviteErr =
      inviteError && "data" in inviteError && typeof (inviteError.data as { message?: string }).message === "string"
        ? (inviteError.data as { message: string }).message
        : null;

    return (
      <div className="w-full min-w-0 px-3 py-4 sm:px-4">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2 mb-4 sm:mb-6">
          <Shield className="h-7 w-7 text-slate-400" />
          All members
        </h1>
        <p className="text-slate-400 text-sm mb-6">
          Manage all users. Set active/inactive to control who can log in. Change roles between Team Manager and User.
        </p>

        <div className="rounded-xl border border-slate-600 bg-slate-800/60 backdrop-blur p-6 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-slate-400" />
              Add members
            </h2>
            <div className="flex rounded-lg border border-slate-600 p-0.5 bg-slate-700/50">
              <button
                type="button"
                onClick={() => setAddMemberMode("one")}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${addMemberMode === "one" ? "bg-slate-600 text-white shadow" : "text-slate-400 hover:text-white"}`}
              >
                Add one
              </button>
              <button
                type="button"
                onClick={() => setAddMemberMode("csv")}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5 ${addMemberMode === "csv" ? "bg-slate-600 text-white shadow" : "text-slate-400 hover:text-white"}`}
              >
                <FileUp className="h-3.5 w-3.5" /> Bulk (CSV)
              </button>
            </div>
          </div>

          {adminTeams.length === 0 ? (
            <p className="text-slate-300 text-sm py-2">
              Add a team first to invite members. Go to <Link to="/teams" className="text-blue-400 hover:underline">Teams</Link> to create one.
            </p>
          ) : addMemberMode === "one" ? (
            <form onSubmit={handleSendInvite} className="flex flex-wrap items-end gap-4">
              <div className="min-w-[140px] flex-1 max-w-[200px]">
                <label htmlFor="addMemberName" className="block text-sm font-medium text-slate-300 mb-1">Name</label>
                <input
                  id="addMemberName"
                  type="text"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  className={inputClass}
                  placeholder="Member name"
                  required
                />
              </div>
              <div className="min-w-[180px] flex-1 max-w-[240px]">
                <label htmlFor="addMemberEmail" className="block text-sm font-medium text-slate-300 mb-1">Email</label>
                <input
                  id="addMemberEmail"
                  type="email"
                  value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
                  className={inputClass}
                  placeholder="member@example.com"
                  required
                />
              </div>
              <div className="min-w-[160px] flex-1 max-w-[220px]">
                <label htmlFor="addMemberTeam" className="block text-sm font-medium text-slate-300 mb-1">Team</label>
                <select
                  id="addMemberTeam"
                  value={addTeamId}
                  onChange={(e) => setAddTeamId(e.target.value)}
                  className={inputClass}
                  required
                >
                  <option value="">Select team</option>
                  {adminTeams.map((t) => (
                    <option key={t._id} value={t._id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={inviting}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition-colors shrink-0"
              >
                {inviting ? "Sending..." : "Send invite"}
              </button>
              {inviteSuccess && <p className="text-emerald-400 text-sm w-full">Invite sent.</p>}
              {inviteErr && <p className="text-red-400 text-sm w-full">{inviteErr}</p>}
            </form>
          ) : (
            <div className="space-y-4 pt-1">
              <p className="text-slate-400 text-sm">
                Upload a CSV with columns: <span className="text-slate-300 font-mono text-xs">name, email, team name</span>. Each row is one invite. Team name must match a team you created.
              </p>
              <div className="flex flex-wrap items-end gap-4">
                <a
                  href="/Add-members.csv"
                  download="Add-members.csv"
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-500 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700 transition-colors shrink-0"
                >
                  <Download className="h-4 w-4" /> Sample CSV
                </a>
                <div className="min-w-0 flex-1 max-w-xs">
                  <label htmlFor="members-csv-input" className="block text-sm font-medium text-slate-300 mb-1">Choose file</label>
                  <input
                    id="members-csv-input"
                    type="file"
                    accept=".csv"
                    onChange={handleCsvFileChange}
                    className="block w-full text-sm text-slate-300 file:mr-3 file:rounded file:border-0 file:bg-slate-600 file:px-3 file:py-2 file:text-white file:hover:bg-slate-500"
                  />
                </div>
                {csvMembers.length > 0 && (
                  <button
                    type="button"
                    onClick={handleSendBulkInvites}
                    disabled={bulkInviting}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition-colors shrink-0"
                  >
                    {bulkInviting ? "Sending..." : `Send ${csvMembers.length} invite${csvMembers.length !== 1 ? "s" : ""}`}
                  </button>
                )}
              </div>
              {csvFile && !csvMembers.length && !csvParseError && <p className="text-slate-500 text-sm">No valid rows in file. Check format.</p>}
              {csvParseError && <p className="text-sm text-red-400">{csvParseError}</p>}
              {csvMembers.length > 0 && !csvParseError && <p className="text-sm text-emerald-400">{csvMembers.length} member{csvMembers.length !== 1 ? "s" : ""} ready to invite.</p>}
              {bulkResult && (
                <p className="text-sm text-slate-300">
                  Sent: <span className="text-emerald-400">{bulkResult.sent}</span>
                  {bulkResult.failed.length > 0 && <span className="text-amber-400"> · Failed: {bulkResult.failed.length}</span>}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-600 bg-slate-800/60 backdrop-blur p-6">
          <div className="rounded-lg border border-slate-600 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-700/50 border-b border-slate-600">
                  <th className="text-left text-slate-300 font-medium px-4 py-3">Name</th>
                  <th className="text-left text-slate-300 font-medium px-4 py-3">Email</th>
                  <th className="text-left text-slate-300 font-medium px-4 py-3">Team</th>
                  <th className="text-left text-slate-300 font-medium px-4 py-3">Role</th>
                  <th className="text-left text-slate-300 font-medium px-4 py-3">Active</th>
                  <th className="text-right text-slate-300 font-medium px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u._id} className="border-b border-slate-600/80 last:border-b-0 hover:bg-slate-700/30">
                    <td className="px-4 py-3 text-white font-medium">{u.name}</td>
                    <td className="px-4 py-3 text-slate-400">{u.email}</td>
                    <td className="px-4 py-3 text-slate-300">{u.teamName ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          u.role === "admin"
                            ? "text-amber-400 font-medium"
                            : u.role === "team_manager"
                              ? "text-blue-400"
                              : "text-slate-300"
                        }
                      >
                        {u.role === "admin" ? "Admin" : u.role === "team_manager" ? "Team Manager" : "User"}
                        {u._id === currentUserId && " (you)"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {u._id === currentUserId ? (
                        <span className="text-slate-500 text-sm">—</span>
                      ) : (
                        <button
                          type="button"
                          disabled={toggling}
                          onClick={() => setUserActive({ userId: u._id, active: !u.active })}
                          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium transition-colors disabled:opacity-50 text-slate-300 hover:bg-slate-600"
                          title={u.active ? "Set inactive" : "Set active"}
                        >
                          {u.active ? (
                            <>
                              <ToggleRight className="h-5 w-5 text-emerald-500" />
                              <span className="text-emerald-400">Active</span>
                            </>
                          ) : (
                            <>
                              <ToggleLeft className="h-5 w-5 text-slate-500" />
                              <span className="text-slate-400">Inactive</span>
                            </>
                          )}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {u.role === "admin" || u._id === currentUserId ? (
                        <span className="text-slate-500 text-sm">—</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingMember(u);
                            setEditRole(u.role === "team_manager" ? "team_manager" : "user");
                            setEditTeamId(u.teamId ?? "");
                          }}
                          className="p-2 rounded-lg text-slate-400 hover:bg-slate-600 hover:text-white transition-colors"
                          title="Edit role and team"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {users.length === 0 && (
            <p className="text-slate-400 text-sm mt-4">No users yet.</p>
          )}
        </div>

        {editingMember && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setEditingMember(null)}>
            <div
              className="w-full max-w-md rounded-xl border border-slate-600 bg-slate-800 p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Edit member</h3>
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="p-1.5 rounded text-slate-400 hover:bg-slate-600 hover:text-white"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Name</label>
                  <p className="text-white">{editingMember.name}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Email</label>
                  <p className="text-slate-300">{editingMember.email}</p>
                </div>
                <div>
                  <label htmlFor="edit-member-role" className="block text-sm font-medium text-slate-300 mb-1">Role</label>
                  <select
                    id="edit-member-role"
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as "team_manager" | "user")}
                    className={inputClass}
                  >
                    <option value="user">User</option>
                    <option value="team_manager">Team Manager</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="edit-member-team" className="block text-sm font-medium text-slate-300 mb-1">Team</label>
                  <select
                    id="edit-member-team"
                    value={editTeamId}
                    onChange={(e) => setEditTeamId(e.target.value)}
                    className={inputClass}
                  >
                    {/* <option value="">No team</option> */}
                    {adminTeams.map((t) => (
                      <option key={t._id} value={t._id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 justify-end mt-6">
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="rounded-lg border border-slate-500 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={updatingMember || (editRole === "team_manager" && !editTeamId)}
                  onClick={async () => {
                    if (!editingMember) return;
                    if (editRole === "team_manager" && !editTeamId) return;
                    try {
                      await updateUserRoleAndTeam({
                        userId: editingMember._id,
                        role: editRole,
                        ...(editTeamId ? { teamId: editTeamId } : {}),
                      }).unwrap();
                      setEditingMember(null);
                      refetchUsers();
                      refetchTeams();
                    } catch {
                      // Error from mutation
                    }
                  }}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  {updatingMember ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!teamData) {
    const errMsg =
      teamError && "data" in teamError && typeof (teamError.data as { message?: string }).message === "string"
        ? (teamError.data as { message: string }).message
        : "Failed to load members.";
    return (
      <div className="w-full min-w-0 px-3 py-4 sm:px-4">
        <p className="text-red-400">{errMsg}</p>
      </div>
    );
  }

  const { team, members, currentUserRole } = teamData;
  const isManager = currentUserRole === "admin";
  const isTeamManager = user?.role === "team_manager";
  const pendingMembers = members.filter((m) => m.status === "pending");

  const handleTeamManagerInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addName.trim() || !addEmail.trim()) return;
    setInviteSuccess(false);
    try {
      await createInvite({ name: addName.trim(), email: addEmail.trim().toLowerCase() }).unwrap();
      setAddName("");
      setAddEmail("");
      setInviteSuccess(true);
    } catch {
      // Error from mutation
    }
  };

  const teamManagerInviteErr =
    inviteError && "data" in inviteError && typeof (inviteError.data as { message?: string }).message === "string"
      ? (inviteError.data as { message: string }).message
      : null;

  return (
    <div className="w-full min-w-0 px-3 py-4 sm:px-4">
      <h1 className="text-2xl font-bold text-white flex items-center gap-2 mb-4 sm:mb-6">
        <Users className="h-7 w-7 text-slate-400" />
        Members
      </h1>
      <p className="text-slate-400 text-sm mb-6">
        {team.name} (Team ID: <span className="font-mono text-slate-300">{team.teamCode}</span>)
      </p>

      {isTeamManager && (
        <div className="rounded-xl border border-slate-600 bg-slate-800/60 backdrop-blur p-6 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-slate-400" />
              Add members to your team
            </h2>
            <div className="flex rounded-lg border border-slate-600 p-0.5 bg-slate-700/50">
              <button
                type="button"
                onClick={() => setAddMemberMode("one")}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${addMemberMode === "one" ? "bg-slate-600 text-white shadow" : "text-slate-400 hover:text-white"}`}
              >
                Add one
              </button>
              <button
                type="button"
                onClick={() => setAddMemberMode("csv")}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5 ${addMemberMode === "csv" ? "bg-slate-600 text-white shadow" : "text-slate-400 hover:text-white"}`}
              >
                <FileUp className="h-3.5 w-3.5" /> Bulk (CSV)
              </button>
            </div>
          </div>
          {addMemberMode === "one" ? (
            <form onSubmit={handleTeamManagerInvite} className="flex flex-wrap items-end gap-4">
              <div className="min-w-[140px] flex-1 max-w-[200px]">
                <label htmlFor="tmAddName" className="block text-sm font-medium text-slate-300 mb-1">Name</label>
                <input
                  id="tmAddName"
                  type="text"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  className={inputClass}
                  placeholder="Member name"
                  required
                />
              </div>
              <div className="min-w-[180px] flex-1 max-w-[240px]">
                <label htmlFor="tmAddEmail" className="block text-sm font-medium text-slate-300 mb-1">Email</label>
                <input
                  id="tmAddEmail"
                  type="email"
                  value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
                  className={inputClass}
                  placeholder="member@example.com"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={inviting}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition-colors shrink-0"
              >
                {inviting ? "Sending..." : "Send invite"}
              </button>
              {inviteSuccess && <p className="text-emerald-400 text-sm w-full">Invite sent.</p>}
              {teamManagerInviteErr && <p className="text-red-400 text-sm w-full">{teamManagerInviteErr}</p>}
            </form>
          ) : (
            <div className="space-y-4 pt-1">
              <p className="text-slate-400 text-sm">
                Upload a CSV with columns: <span className="text-slate-300 font-mono text-xs">name, email</span>. Team name column is optional; all invites go to your team.
              </p>
              <div className="flex flex-wrap items-end gap-4">
                <a
                  href="/Add-members.csv"
                  download="Add-members.csv"
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-500 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700 transition-colors shrink-0"
                >
                  <Download className="h-4 w-4" /> Sample CSV
                </a>
                <div className="min-w-0 flex-1 max-w-xs">
                  <label htmlFor="tm-members-csv-input" className="block text-sm font-medium text-slate-300 mb-1">Choose file</label>
                  <input
                    id="tm-members-csv-input"
                    type="file"
                    accept=".csv"
                    onChange={handleCsvFileChange}
                    className="block w-full text-sm text-slate-300 file:mr-3 file:rounded file:border-0 file:bg-slate-600 file:px-3 file:py-2 file:text-white file:hover:bg-slate-500"
                  />
                </div>
                {csvMembers.length > 0 && (
                  <button
                    type="button"
                    onClick={handleSendBulkInvites}
                    disabled={bulkInviting}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition-colors shrink-0"
                  >
                    {bulkInviting ? "Sending..." : `Send ${csvMembers.length} invite${csvMembers.length !== 1 ? "s" : ""}`}
                  </button>
                )}
              </div>
              {csvParseError && <p className="text-sm text-red-400">{csvParseError}</p>}
              {csvMembers.length > 0 && !csvParseError && <p className="text-sm text-emerald-400">{csvMembers.length} member{csvMembers.length !== 1 ? "s" : ""} ready to invite.</p>}
              {bulkResult && (
                <p className="text-sm text-slate-300">
                  Sent: <span className="text-emerald-400">{bulkResult.sent}</span>
                  {bulkResult.failed.length > 0 && <span className="text-amber-400"> · Failed: {bulkResult.failed.length}</span>}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {pendingMembers.length > 0 && isManager && (
        <div className="rounded-xl border border-amber-700/50 bg-amber-900/20 backdrop-blur p-6 mb-6">
          <h2 className="text-sm font-semibold text-amber-200 mb-3 flex items-center gap-2">
            Pending approval
          </h2>
          <ul className="space-y-2">
            {pendingMembers.map((m) => (
              <li
                key={m._id}
                className="flex items-center justify-between gap-4 py-2 px-3 rounded-lg bg-slate-800/60"
              >
                <div>
                  <span className="font-medium text-white">{m.name}</span>
                  <span className="text-slate-400 text-sm ml-2">({m.email})</span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => approveMember(m.userId)}
                    disabled={approving || rejecting}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
                  >
                    <UserCheck className="h-4 w-4" />
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => rejectMember(m.userId)}
                    disabled={approving || rejecting}
                    className="flex items-center gap-1.5 rounded-lg bg-red-600/80 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50 transition-colors"
                  >
                    <UserX className="h-4 w-4" />
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-xl border border-slate-600 bg-slate-800/60 backdrop-blur p-6">
        <div className="rounded-lg border border-slate-600 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-700/50 border-b border-slate-600">
                <th className="text-left text-slate-300 font-medium px-4 py-3">Name</th>
                <th className="text-left text-slate-300 font-medium px-4 py-3">Email</th>
                <th className="text-left text-slate-300 font-medium px-4 py-3">Role</th>
                <th className="text-right text-slate-300 font-medium px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m._id} className="border-b border-slate-600/80 last:border-b-0 hover:bg-slate-700/30">
                  <td className="px-4 py-3 text-white font-medium">{m.name}</td>
                  <td className="px-4 py-3 text-slate-400">{m.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        m.role === "admin"
                          ? "text-amber-400 font-medium"
                          : "text-slate-300"
                      }
                    >
                      {m.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={
                        m.status === "active"
                          ? "text-emerald-400"
                          : "text-amber-400"
                      }
                    >
                      {m.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
