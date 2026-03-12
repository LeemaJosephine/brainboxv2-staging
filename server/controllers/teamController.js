const Organization = require("../models/Organization");
const OrganizationMember = require("../models/OrganizationMember");
const Quiz = require("../models/Quiz");
const User = require("../models/User");
const { sendEmail } = require("../utils/email");

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function generateTeamCode() {
  return Array.from({ length: 9 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join("");
}

async function sendTeamCodeEmail(toEmail, teamName, teamCode) {
  await sendEmail({
    to: toEmail,
    subject: `Your Team ID — ${teamName}`,
    text: `Your team "${teamName}" has been created.\n\nTeam ID (share this with members to join): ${teamCode}\n\nKeep this ID safe; the team manager will use it to invite others.`,
    html: `
      <p>Your team <strong>${escapeHtml(teamName)}</strong> has been created.</p>
      <p><strong>Team ID</strong> (share this with members to join): <code style="background:#f1f5f9;padding:4px 8px;border-radius:4px;">${escapeHtml(teamCode)}</code></p>
      <p>Keep this ID safe; you will need it to invite others.</p>
    `,
  });
}

function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toTeamResponse(org) {
  if (!org) return null;
  return {
    _id: org._id,
    name: org.name,
    teamCode: org.orgId,
  };
}

/** List all teams (admin only). Returns teams created by this admin with teamManagerName and memberCount. */
exports.listTeams = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only platform Admin can list teams" });
    }
    const teams = await Organization.find({ createdBy: req.user._id })
      .sort({ createdAt: -1 })
      .select("_id name orgId createdAt")
      .lean();
    const teamIds = teams.map((t) => t._id);
    const memberDocs = await OrganizationMember.find({ organizationId: { $in: teamIds } })
      .populate("userId", "name role")
      .select("organizationId userId role")
      .lean();
    const byOrg = {};
    memberDocs.forEach((m) => {
      if (!m.userId || m.userId.role === "admin") return; // Platform admins are not part of any team
      const id = m.organizationId.toString();
      if (!byOrg[id]) byOrg[id] = { count: 0, teamManagerName: null };
      byOrg[id].count += 1;
      if (m.role === "admin") byOrg[id].teamManagerName = m.userId.name;
    });
    res.json({
      teams: teams.map((t) => {
        const id = t._id.toString();
        const meta = byOrg[id] || { count: 0, teamManagerName: null };
        return {
          _id: t._id,
          name: t.name,
          teamCode: t.orgId,
          createdAt: t.createdAt,
          teamManagerName: meta.teamManagerName || null,
          memberCount: meta.count,
        };
      }),
    });
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to list teams" });
  }
};

/** Create a team. Platform admin only. Admin is not added as a member and can create multiple teams. */
exports.createTeam = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only platform Admin can create teams. Please join an existing team." });
    }
    const { name } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: "Team name is required" });
    }
    let orgId;
    let exists = true;
    while (exists) {
      orgId = generateTeamCode();
      const found = await Organization.findOne({ orgId });
      exists = !!found;
    }
    const org = await Organization.create({
      name: String(name).trim(),
      orgId,
      createdBy: req.user._id,
    });
    try {
      await sendTeamCodeEmail(req.user.email, org.name, orgId);
    } catch (emailErr) {
      console.error("Send team ID email failed:", emailErr);
    }
    res.status(201).json({
      team: toTeamResponse(org),
    });
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to create team" });
  }
};

/** Update a team (admin only). Only teams created by this admin. Body: { name }. */
exports.updateTeam = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only platform Admin can edit teams" });
    }
    const teamId = req.params.id;
    const name = req.body.name != null ? String(req.body.name).trim() : "";
    if (!name) {
      return res.status(400).json({ message: "Team name is required" });
    }
    const org = await Organization.findOne({ _id: teamId, createdBy: req.user._id });
    if (!org) {
      return res.status(404).json({ message: "Team not found or you can only edit teams you created" });
    }
    org.name = name;
    await org.save();
    res.json({ team: toTeamResponse(org) });
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to update team" });
  }
};

/** Delete a team (admin only). Only teams created by this admin. Removes team and its members; quizzes become global. */
exports.deleteTeam = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only platform Admin can delete teams" });
    }
    const teamId = req.params.id;
    const org = await Organization.findOne({ _id: teamId, createdBy: req.user._id });
    if (!org) {
      return res.status(404).json({ message: "Team not found or you can only delete teams you created" });
    }
    await OrganizationMember.deleteMany({ organizationId: org._id });
    await Quiz.updateMany({ organizationId: org._id }, { $set: { organizationId: null } });
    await Organization.deleteOne({ _id: org._id });
    res.json({ message: "Team deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to delete team" });
  }
};

exports.joinTeam = async (req, res) => {
  try {
    const teamCodeInput = req.body.teamCode ? String(req.body.teamCode).trim().toUpperCase() : "";
    const userId = req.user._id;
    if (!teamCodeInput) {
      return res.status(400).json({ message: "Team ID is required" });
    }
    const org = await Organization.findOne({ orgId: teamCodeInput });
    if (!org) {
      return res.status(404).json({ message: "Team not found with this ID" });
    }
    if (req.user.role === "admin") {
      return res.status(403).json({ message: "Admin cannot join teams. Admin only creates teams." });
    }
    const existing = await OrganizationMember.findOne({ userId });
    if (existing) {
      if (existing.organizationId.toString() === org._id.toString()) {
        if (existing.status === "active") {
          return res.status(400).json({ message: "You are already a member of this team" });
        }
        return res.status(400).json({ message: "Your request is pending approval" });
      }
      return res.status(400).json({
        message: "You can only belong to one team. This account has already joined a team.",
      });
    }
    const hasTeamManager = await OrganizationMember.findOne({
      organizationId: org._id,
      status: "active",
      role: "admin",
    });
    const isFirstMember = !hasTeamManager;
    const memberDoc = await OrganizationMember.create({
      organizationId: org._id,
      userId,
      role: isFirstMember ? "admin" : "member",
      status: isFirstMember ? "active" : "pending",
    });
    if (isFirstMember) {
      await User.findByIdAndUpdate(userId, { role: "team_manager" });
    }
    res.status(201).json({
      team: toTeamResponse(org),
      membership: {
        teamId: org._id.toString(),
        teamName: org.name,
        teamCode: org.orgId,
        role: memberDoc.role,
        status: memberDoc.status,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to join team" });
  }
};

/** Get members of a specific team (admin only). Used for team list modal. */
exports.getTeamMembersByTeamId = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only platform Admin can view team members" });
    }
    const teamId = req.params.teamId;
    const org = await Organization.findOne({ _id: teamId, createdBy: req.user._id }).select("name orgId").lean();
    if (!org) {
      return res.status(404).json({ message: "Team not found or you can only view teams you created" });
    }
    const members = await OrganizationMember.find({ organizationId: teamId })
      .populate("userId", "name email role")
      .sort({ createdAt: 1 })
      .lean();
    // Platform admins are not part of any team; exclude them from the list
    const list = members
      .filter((m) => m.userId && m.userId.role !== "admin")
      .map((m) => ({
        _id: m._id,
        userId: m.userId._id,
        name: m.userId.name,
        email: m.userId.email,
        role: m.role,
        status: m.status,
        createdAt: m.createdAt,
      }));
    res.json({
      team: { _id: teamId, name: org.name, teamCode: org.orgId },
      members: list,
    });
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to get team members" });
  }
};

exports.getMembers = async (req, res) => {
  try {
    const userId = req.user._id;
    const myMembership = await OrganizationMember.findOne({
      userId,
      status: "active",
    }).populate("organizationId", "name orgId");
    if (!myMembership || !myMembership.organizationId) {
      return res.status(403).json({ message: "You must belong to a team to view members" });
    }
    const members = await OrganizationMember.find({
      organizationId: myMembership.organizationId._id,
    })
      .populate("userId", "name email role")
      .sort({ createdAt: 1 })
      .lean();
    // Platform admins are not part of any team; exclude them from the list
    const list = members
      .filter((m) => m.userId && m.userId.role !== "admin")
      .map((m) => ({
        _id: m._id,
        userId: m.userId._id,
        name: m.userId.name,
        email: m.userId.email,
        role: m.role,
        status: m.status,
        createdAt: m.createdAt,
      }));
    res.json({
      team: {
        _id: myMembership.organizationId._id,
        name: myMembership.organizationId.name,
        teamCode: myMembership.organizationId.orgId,
      },
      members: list,
      currentUserRole: myMembership.role,
    });
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to get members" });
  }
};

exports.approveMember = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const targetUserId = req.params.userId;
    const adminMembership = await OrganizationMember.findOne({
      userId: currentUserId,
      status: "active",
      role: "admin",
    });
    if (!adminMembership) {
      return res.status(403).json({ message: "Only team managers can approve members" });
    }
    const memberDoc = await OrganizationMember.findOne({
      organizationId: adminMembership.organizationId,
      userId: targetUserId,
      status: "pending",
    });
    if (!memberDoc) {
      return res.status(404).json({ message: "Pending member not found" });
    }
    memberDoc.status = "active";
    await memberDoc.save();
    res.json({
      message: "Member approved",
      membership: {
        userId: memberDoc.userId,
        role: memberDoc.role,
        status: memberDoc.status,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to approve member" });
  }
};

exports.rejectMember = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const targetUserId = req.params.userId;
    const adminMembership = await OrganizationMember.findOne({
      userId: currentUserId,
      status: "active",
      role: "admin",
    });
    if (!adminMembership) {
      return res.status(403).json({ message: "Only team managers can reject members" });
    }
    const result = await OrganizationMember.findOneAndDelete({
      organizationId: adminMembership.organizationId,
      userId: targetUserId,
      status: "pending",
    });
    if (!result) {
      return res.status(404).json({ message: "Pending member not found" });
    }
    res.json({ message: "Member rejected" });
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to reject member" });
  }
};
