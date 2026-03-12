const Invite = require("../models/Invite");
const User = require("../models/User");
const Organization = require("../models/Organization");
const OrganizationMember = require("../models/OrganizationMember");
const { sendEmail } = require("../utils/email");

const INVITE_EXPIRY_DAYS = 7;
const frontendBaseUrl = () =>
  (process.env.FRONTEND_URL || process.env.CLIENT_URL || "http://localhost:5173").replace(/\/$/, "");

function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Create invite and send email. Admin: body { name, email, teamId }. Team manager: body { name, email } (invites to their team only). */
exports.createInvite = async (req, res) => {
  try {
    const name = req.body.name != null ? String(req.body.name).trim() : "";
    const email = req.body.email != null ? String(req.body.email).trim().toLowerCase() : "";
    const teamId = req.body.teamId;

    if (!name) return res.status(400).json({ message: "Name is required" });
    if (!email) return res.status(400).json({ message: "Email is required" });
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return res.status(400).json({ message: "Invalid email format" });

    let org;
    if (req.user.role === "admin") {
      if (!teamId) return res.status(400).json({ message: "Team is required" });
      org = await Organization.findOne({ _id: teamId, createdBy: req.user._id });
      if (!org) {
        return res.status(404).json({ message: "Team not found or you can only invite to teams you created" });
      }
    } else if (req.user.role === "team_manager") {
      const membership = await OrganizationMember.findOne({
        userId: req.user._id,
        status: "active",
      }).populate("organizationId");
      if (!membership || !membership.organizationId) {
        return res.status(403).json({ message: "You must be in a team to invite members" });
      }
      org = membership.organizationId;
    } else {
      return res.status(403).json({ message: "Only admin or team manager can invite members" });
    }

    const existing = await Invite.findOne({
      email,
      organizationId: org._id,
      status: "pending",
    });
    if (existing && existing.expiresAt > new Date()) {
      return res.status(400).json({ message: "An invite has already been sent to this email for this team" });
    }

    const invite = await Invite.createInvite({
      email,
      name,
      organizationId: org._id,
      createdBy: req.user._id,
    });

    const acceptUrl = `${frontendBaseUrl()}/invite/accept?token=${invite.token}`;
    try {
      await sendEmail({
        to: email,
        subject: `You're invited to join ${org.name} on Brainbox`,
        text: `Hi ${name},\n\nYou've been invited to join the team "${org.name}" on Brainbox.\n\nClick the link below to set your password and join:\n${acceptUrl}\n\nThis link expires in ${INVITE_EXPIRY_DAYS} days.`,
        html: `
          <p>Hi ${escapeHtml(name)},</p>
          <p>You've been invited to join the team <strong>${escapeHtml(org.name)}</strong> on Brainbox.</p>
          <p><a href="${escapeHtml(acceptUrl)}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;">Set password &amp; join</a></p>
          <p>Or copy this link: <br><code style="word-break:break-all;">${escapeHtml(acceptUrl)}</code></p>
          <p>This link expires in ${INVITE_EXPIRY_DAYS} days.</p>
        `,
      });
    } catch (emailErr) {
      console.error("Invite email failed:", emailErr);
      await Invite.deleteOne({ _id: invite._id });
      return res.status(500).json({ message: "Failed to send invite email" });
    }

    res.status(201).json({
      message: "Invite sent",
      invite: { _id: invite._id, email: invite.email, name: invite.name, teamId: org._id, teamName: org.name },
    });
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to create invite" });
  }
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Bulk create invites from CSV data. Body: { invites: [ { name, email, teamName? } ] }. Admin: teamName required per row. Team manager: teamName ignored, all to their team. */
exports.createBulkInvite = async (req, res) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "team_manager") {
      return res.status(403).json({ message: "Only admin or team manager can invite members" });
    }

    const raw = req.body.invites;
    if (!Array.isArray(raw) || raw.length === 0) {
      return res.status(400).json({ message: "invites array is required and must not be empty" });
    }

    let defaultOrg = null;
    if (req.user.role === "team_manager") {
      const membership = await OrganizationMember.findOne({
        userId: req.user._id,
        status: "active",
      }).populate("organizationId");
      if (!membership || !membership.organizationId) {
        return res.status(403).json({ message: "You must be in a team to invite members" });
      }
      defaultOrg = membership.organizationId;
    }

    const failed = [];
    let sent = 0;

    for (let i = 0; i < raw.length; i++) {
      const item = raw[i];
      const name = item.name != null ? String(item.name).trim() : "";
      const email = item.email != null ? String(item.email).trim().toLowerCase() : "";
      const teamName = item.teamName != null ? String(item.teamName).trim() : "";

      if (!name || !email) {
        failed.push({ index: i + 1, email: email || "(missing)", message: "Name and email are required" });
        continue;
      }
      if (!emailRegex.test(email)) {
        failed.push({ index: i + 1, email, message: "Invalid email format" });
        continue;
      }

      let org;
      if (req.user.role === "admin") {
        if (!teamName) {
          failed.push({ index: i + 1, email, message: "Team name is required for admin" });
          continue;
        }
        org = await Organization.findOne({ name: teamName, createdBy: req.user._id });
        if (!org) {
          failed.push({ index: i + 1, email, message: `Team "${teamName}" not found or not created by you` });
          continue;
        }
      } else {
        org = defaultOrg;
      }

      const existing = await Invite.findOne({
        email,
        organizationId: org._id,
        status: "pending",
      });
      if (existing && existing.expiresAt > new Date()) {
        failed.push({ index: i + 1, email, message: "Invite already sent for this email in this team" });
        continue;
      }

      let createdInvite = null;
      try {
        createdInvite = await Invite.createInvite({
          email,
          name,
          organizationId: org._id,
          createdBy: req.user._id,
        });
        const acceptUrl = `${frontendBaseUrl()}/invite/accept?token=${createdInvite.token}`;
        await sendEmail({
          to: email,
          subject: `You're invited to join ${org.name} on Brainbox`,
          text: `Hi ${name},\n\nYou've been invited to join the team "${org.name}" on Brainbox.\n\nClick the link below to set your password and join:\n${acceptUrl}\n\nThis link expires in ${INVITE_EXPIRY_DAYS} days.`,
          html: `
            <p>Hi ${escapeHtml(name)},</p>
            <p>You've been invited to join the team <strong>${escapeHtml(org.name)}</strong> on Brainbox.</p>
            <p><a href="${escapeHtml(acceptUrl)}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;">Set password &amp; join</a></p>
            <p>Or copy this link: <br><code style="word-break:break-all;">${escapeHtml(acceptUrl)}</code></p>
            <p>This link expires in ${INVITE_EXPIRY_DAYS} days.</p>
          `,
        });
        sent++;
      } catch (err) {
        if (createdInvite && createdInvite._id) await Invite.deleteOne({ _id: createdInvite._id }).catch(() => {});
        failed.push({ index: i + 1, email, message: err.message || "Failed to send invite" });
      }
    }

    res.status(200).json({ message: `Invites sent: ${sent}`, sent, failed });
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to create bulk invites" });
  }
};

/** Validate invite token (public). Returns invite details for the set-password form. */
exports.validateInvite = async (req, res) => {
  try {
    const token = req.params.token;
    if (!token) return res.status(400).json({ message: "Token is required" });

    const invite = await Invite.findOne({ token, status: "pending" })
      .populate("organizationId", "name")
      .lean();
    if (!invite || !invite.organizationId) {
      return res.status(400).json({ message: "Invalid or expired invite link" });
    }
    if (invite.expiresAt < new Date()) {
      return res.status(400).json({ message: "This invite link has expired" });
    }

    res.json({
      valid: true,
      name: invite.name,
      email: invite.email,
      teamName: invite.organizationId.name,
    });
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to validate invite" });
  }
};

/** Accept invite: set password, create user if needed, add to team (public). */
exports.acceptInvite = async (req, res) => {
  try {
    const token = req.body.token;
    const password = req.body.password;
    const confirmPassword = req.body.confirmPassword;

    if (!token) return res.status(400).json({ message: "Token is required" });
    if (!password || String(password).length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    const invite = await Invite.findOne({ token, status: "pending" }).populate("organizationId");
    if (!invite || !invite.organizationId) {
      return res.status(400).json({ message: "Invalid or expired invite link" });
    }
    if (invite.expiresAt < new Date()) {
      return res.status(400).json({ message: "This invite link has expired" });
    }

    let user = await User.findOne({ email: invite.email });
    if (!user) {
      user = await User.create({
        name: invite.name,
        email: invite.email,
        password: String(password),
        role: "user",
        active: true,
      });
    }

    const existingMember = await OrganizationMember.findOne({
      organizationId: invite.organizationId._id,
      userId: user._id,
    });
    if (!existingMember) {
      await OrganizationMember.create({
        organizationId: invite.organizationId._id,
        userId: user._id,
        role: "member",
        status: "active",
      });
    } else if (existingMember.status !== "active") {
      existingMember.status = "active";
      await existingMember.save();
    }

    invite.status = "accepted";
    await invite.save();

    res.json({
      message: "Password set. You can now log in.",
      email: invite.email,
    });
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to accept invite" });
  }
};
