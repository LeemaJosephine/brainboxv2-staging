const User = require("../models/User");
const OrganizationMember = require("../models/OrganizationMember");
const Organization = require("../models/Organization");

/**
 * List all users (admin only). Returns id, name, email, role, active, createdAt, teamId, teamName.
 */
exports.listAllUsers = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only admin can view all users" });
    }
    const users = await User.find({})
      .select("name email role active createdAt")
      .sort({ createdAt: -1 })
      .lean();
    const userIds = users.map((u) => u._id);
    const memberships = await OrganizationMember.find({ userId: { $in: userIds }, status: "active" })
      .populate("organizationId", "name")
      .select("userId organizationId")
      .lean();
    const teamByUser = {};
    memberships.forEach((m) => {
      if (m.organizationId) {
        teamByUser[m.userId.toString()] = {
          teamId: m.organizationId._id.toString(),
          teamName: m.organizationId.name,
        };
      }
    });
    const list = users.map((u) => {
      const id = u._id.toString();
      const team = teamByUser[id] || null;
      return {
        _id: u._id,
        name: u.name,
        email: u.email,
        role: u.role === "admin" || u.role === "team_manager" ? u.role : "user",
        active: u.active !== false,
        createdAt: u.createdAt,
        teamId: team ? team.teamId : null,
        teamName: team ? team.teamName : null,
      };
    });
    res.json({ users: list });
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to list users" });
  }
};

/**
 * Set user active status (admin only). Body: { active: boolean }.
 */
exports.setUserActive = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only admin can change user active status" });
    }
    const userId = req.params.id;
    const active = req.body.active;
    if (typeof active !== "boolean") {
      return res.status(400).json({ message: "active must be true or false" });
    }
    const user = await User.findById(userId).select("name email role active");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    user.active = active;
    await user.save();
    res.json({
      message: active ? "User activated" : "User deactivated",
      user: { _id: user._id, name: user.name, email: user.email, role: user.role, active: user.active },
    });
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to update user" });
  }
};

/**
 * Set user role to team_manager or user (admin only). Syncs OrganizationMember.role.
 * Body: { role: "team_manager" | "user" }.
 */
exports.setUserRole = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only admin can change user role" });
    }
    const targetUserId = req.params.id;
    const role = req.body.role;
    if (role !== "team_manager" && role !== "user") {
      return res.status(400).json({ message: "role must be team_manager or user" });
    }
    const user = await User.findById(targetUserId).select("name email role");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    if (user.role === "admin") {
      return res.status(400).json({ message: "Cannot change admin role" });
    }
    user.role = role;
    await user.save();
    const memberRole = role === "team_manager" ? "admin" : "member";
    await OrganizationMember.updateOne(
      { userId: targetUserId },
      { $set: { role: memberRole } }
    );
    res.json({
      message: "Role updated",
      user: { _id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to update role" });
  }
};

/**
 * Update user role and/or team (admin only). Body: { role?: "team_manager"|"user", teamId?: string }.
 * At least one of role or teamId required. Cannot change admin users.
 */
exports.updateUserRoleAndTeam = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only admin can update member role and team" });
    }
    const targetUserId = req.params.id;
    const { role, teamId } = req.body;

    if (!role && !teamId) {
      return res.status(400).json({ message: "Provide role and/or teamId" });
    }
    if (role && role !== "team_manager" && role !== "user") {
      return res.status(400).json({ message: "role must be team_manager or user" });
    }

    const user = await User.findById(targetUserId).select("name email role");
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.role === "admin") {
      return res.status(400).json({ message: "Cannot change admin user" });
    }

    if (role) {
      user.role = role;
      await user.save();
      const memberRole = role === "team_manager" ? "admin" : "member";
      await OrganizationMember.updateMany(
        { userId: targetUserId },
        { $set: { role: memberRole } }
      );
    }

    if (teamId) {
      const org = await Organization.findOne({ _id: teamId, createdBy: req.user._id });
      if (!org) {
        return res.status(404).json({ message: "Team not found or you can only assign teams you created" });
      }
      await OrganizationMember.deleteMany({ userId: targetUserId });
      if (user.role === "team_manager") {
        const previousAdmins = await OrganizationMember.find({
          organizationId: teamId,
          role: "admin",
        })
          .select("userId")
          .lean();
        for (const pa of previousAdmins) {
          await User.findByIdAndUpdate(pa.userId, { role: "user" });
          await OrganizationMember.updateOne(
            { organizationId: teamId, userId: pa.userId },
            { $set: { role: "member" } }
          );
        }
      }
      await OrganizationMember.create({
        organizationId: teamId,
        userId: targetUserId,
        role: user.role === "team_manager" ? "admin" : "member",
        status: "active",
      });
    }

    const membership = await OrganizationMember.findOne({
      userId: targetUserId,
      status: "active",
    }).populate("organizationId", "name");
    const teamName = membership?.organizationId?.name ?? null;
    const resolvedTeamId = membership?.organizationId?._id?.toString() ?? null;

    res.json({
      message: "Member updated",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        teamId: resolvedTeamId,
        teamName,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to update member" });
  }
};

/**
 * Delete a user by email (admin only). Body: { email: string }.
 */
exports.deleteUserByEmail = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only admin can delete users" });
    }

    const rawEmail = req.body.email;
    const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";

    if (!email) {
      return res.status(400).json({ message: "email is required" });
    }

    const user = await User.findOne({ email }).select("_id name email role");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role === "admin") {
      return res.status(400).json({ message: "Cannot delete admin user" });
    }

    await OrganizationMember.deleteMany({ userId: user._id });

    await User.deleteOne({ _id: user._id });

    res.json({
      message: "User deleted",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to delete user" });
  }
};
