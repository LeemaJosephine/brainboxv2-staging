const User = require("../models/User");
const OrganizationMember = require("../models/OrganizationMember");
const Organization = require("../models/Organization");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { sendEmail } = require("../utils/email");

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

const sanitizeUser = (user) => {
  const obj = user.toObject ? user.toObject() : { ...user };
  delete obj.password;
  if (obj.role === undefined && user.role !== undefined) obj.role = user.role;
  if (obj.active === undefined && user.active !== undefined) obj.active = user.active;
  return obj;
};

async function getActiveMembership(userId) {
  const member = await OrganizationMember.findOne({
    userId,
    status: "active",
  })
    .populate("organizationId", "name orgId")
    .lean();
  if (!member || !member.organizationId) return null;
  return {
    teamId: member.organizationId._id.toString(),
    teamName: member.organizationId.name,
    teamCode: member.organizationId.orgId,
    role: member.role,
    status: member.status,
  };
}

async function getAnyMembership(userId) {
  const member = await OrganizationMember.findOne({ userId })
    .populate("organizationId", "name orgId")
    .sort({ createdAt: -1 })
    .lean();
  if (!member || !member.organizationId) return null;
  return {
    teamId: member.organizationId._id.toString(),
    teamName: member.organizationId.name,
    teamCode: member.organizationId.orgId,
    role: member.role,
    status: member.status,
  };
}

/**
 * Register a new user with platform Admin role.
 * Body: name (username), email, password.
 * Password is hashed via User model pre-save (bcrypt, 10 rounds).
 */
exports.register = async (req, res) => {
  try {
    const name = req.body.name != null ? String(req.body.name).trim() : "";
    const email = req.body.email != null ? String(req.body.email).trim().toLowerCase() : "";
    const password = req.body.password != null ? String(req.body.password) : "";

    if (!name) {
      return res.status(400).json({ message: "Name is required" });
    }
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "User already exists with this email" });
    }

    const user = await User.create({
      name,
      email,
      password,
      role: "admin",
    });
    const token = generateToken(user._id);
    const membership = await getActiveMembership(user._id);
    res.status(201).json({
      token,
      user: sanitizeUser(user),
      membership: membership || undefined,
    });
  } catch (error) {
    res.status(500).json({ message: error.message || "Registration failed" });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    const match = await user.comparePassword(password);
    if (!match) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    if (user.active === false) {
      return res.status(403).json({
        message: "Your account is inactive. Please contact your admin to activate your account.",
        code: "ACCOUNT_INACTIVE",
      });
    }
    const token = generateToken(user._id);
    const membership = await getAnyMembership(user._id);
    const userObj = sanitizeUser(user);
    if (!userObj.role) userObj.role = user.role || "user";
    res.json({
      token,
      user: userObj,
      membership: membership || undefined,
    });
  } catch (error) {
    res.status(500).json({ message: error.message || "Login failed" });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !String(email).trim()) {
      return res.status(400).json({ message: "Email is required" });
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
    // Always respond with generic message to avoid leaking which emails exist
    const genericMessage = "If an account exists for this email, an OTP has been sent.";
    if (!user) {
      return res.json({ message: genericMessage });
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const hash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    user.resetOtpHash = hash;
    user.resetOtpExpiresAt = expiresAt;
    await user.save();

    await sendEmail({
      to: normalizedEmail,
      subject: "Brain Box password reset OTP",
      text: `Your Brain Box password reset OTP is ${otp}. It is valid for 5 minutes.`,
      html: `<p>Your Brain Box password reset OTP is <strong>${otp}</strong>.</p><p>It is valid for 5 minutes.</p>`,
    });

    res.json({ message: genericMessage });
  } catch (error) {
    console.error("Forgot password email error:", error);
    const message = error.message || "Failed to send reset OTP";
    res.status(500).json({ message: message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, password } = req.body;
    if (!email || !otp || !password) {
      return res.status(400).json({ message: "Email, OTP and new password are required" });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail }).select("+resetOtpHash");
    if (!user || !user.resetOtpHash || !user.resetOtpExpiresAt) {
      return res.status(400).json({ message: "Invalid email or OTP" });
    }
    if (user.resetOtpExpiresAt.getTime() < Date.now()) {
      return res.status(400).json({ message: "OTP has expired. Please request a new one." });
    }
    const otpValid = await bcrypt.compare(String(otp).trim(), user.resetOtpHash);
    if (!otpValid) {
      return res.status(400).json({ message: "Invalid email or OTP" });
    }

    user.password = String(password);
    user.resetOtpHash = undefined;
    user.resetOtpExpiresAt = undefined;
    await user.save();

    res.json({ message: "Password updated successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to reset password" });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = req.user;
    if (user.active === false) {
      return res.status(403).json({
        message: "Your account is inactive. Please contact your admin to activate your account.",
        code: "ACCOUNT_INACTIVE",
      });
    }
    const membership = await getAnyMembership(user._id);
    const userObj = sanitizeUser(user);
    if (!userObj.role) userObj.role = user.role || "user";
    if (userObj.active === undefined) userObj.active = user.active !== false;
    res.json({
      user: userObj,
      membership: membership || undefined,
    });
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to get user" });
  }
};
