const mongoose = require("mongoose");
const crypto = require("crypto");

const inviteSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true },
    token: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["pending", "accepted"], default: "pending" },
  },
  { timestamps: true }
);

inviteSchema.index({ token: 1 });
inviteSchema.index({ email: 1, organizationId: 1 });

function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

inviteSchema.statics.createInvite = async function (data) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  return this.create({
    ...data,
    token,
    expiresAt,
  });
};

module.exports = mongoose.model("Invite", inviteSchema);
