const Organization = require("../models/Organization");
const OrganizationMember = require("../models/OrganizationMember");
const { sendEmail } = require("../utils/email");

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function generateOrgId() {
  return Array.from({ length: 9 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join("");
}

async function sendOrgIdEmail(toEmail, orgName, orgId) {
  await sendEmail({
    to: toEmail,
    subject: `Your Organization ID — ${orgName}`,
    text: `Your organization "${orgName}" has been created.\n\nOrganization ID (share this with members to join): ${orgId}\n\nKeep this ID safe; you will need it to invite others.`,
    html: `
      <p>Your organization <strong>${escapeHtml(orgName)}</strong> has been created.</p>
      <p><strong>Organization ID</strong> (share this with members to join): <code style="background:#f1f5f9;padding:4px 8px;border-radius:4px;">${escapeHtml(orgId)}</code></p>
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

exports.createOrganization = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only platform Admin can create organizations. Please join an existing organization." });
    }
    const { name } = req.body;
    const userId = req.user._id;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: "Organization name is required" });
    }
    const existingMembership = await OrganizationMember.findOne({ userId });
    if (existingMembership) {
      return res.status(400).json({
        message: "You can only belong to one organization. This account has already created or joined an organization.",
      });
    }
    let orgId;
    let exists = true;
    while (exists) {
      orgId = generateOrgId();
      const found = await Organization.findOne({ orgId });
      exists = !!found;
    }
    const org = await Organization.create({
      name: String(name).trim(),
      orgId,
      createdBy: userId,
    });
    await OrganizationMember.create({
      organizationId: org._id,
      userId,
      role: "admin",
      status: "active",
    });
    try {
      await sendOrgIdEmail(req.user.email, org.name, orgId);
    } catch (emailErr) {
      console.error("Send org ID email failed:", emailErr);
      // still return success; org was created
    }
    res.status(201).json({
      organization: {
        _id: org._id,
        name: org.name,
        orgId: org.orgId,
      },
      membership: {
        organizationId: org._id.toString(),
        orgName: org.name,
        orgId: org.orgId,
        role: "admin",
        status: "active",
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to create organization" });
  }
};

exports.joinOrganization = async (req, res) => {
  try {
    const orgIdInput = req.body.orgId ? String(req.body.orgId).trim().toUpperCase() : "";
    const userId = req.user._id;
    if (!orgIdInput) {
      return res.status(400).json({ message: "Organization ID is required" });
    }
    const org = await Organization.findOne({ orgId: orgIdInput });
    if (!org) {
      return res.status(404).json({ message: "Organization not found with this ID" });
    }
    const existing = await OrganizationMember.findOne({ userId });
    if (existing) {
      if (existing.organizationId.toString() === org._id.toString()) {
        if (existing.status === "active") {
          return res.status(400).json({ message: "You are already a member of this organization" });
        }
        return res.status(400).json({ message: "Your request is pending approval" });
      }
      return res.status(400).json({
        message: "You can only belong to one organization. This account has already created or joined an organization.",
      });
    }
    await OrganizationMember.create({
      organizationId: org._id,
      userId,
      role: "member",
      status: "pending",
    });
    res.status(201).json({
      organization: { _id: org._id, name: org.name, orgId: org.orgId },
      membership: {
        organizationId: org._id.toString(),
        orgName: org.name,
        orgId: org.orgId,
        role: "member",
        status: "pending",
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to join organization" });
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
      return res.status(403).json({ message: "You must belong to an organization to view members" });
    }
    const members = await OrganizationMember.find({
      organizationId: myMembership.organizationId._id,
    })
      .populate("userId", "name email")
      .sort({ createdAt: 1 })
      .lean();
    const list = members.map((m) => ({
      _id: m._id,
      userId: m.userId._id,
      name: m.userId.name,
      email: m.userId.email,
      role: m.role,
      status: m.status,
      createdAt: m.createdAt,
    }));
    res.json({
      organization: {
        _id: myMembership.organizationId._id,
        name: myMembership.organizationId.name,
        orgId: myMembership.organizationId.orgId,
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
      return res.status(403).json({ message: "Only admins can approve members" });
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
      return res.status(403).json({ message: "Only admins can reject members" });
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
