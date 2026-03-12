const mongoose = require("mongoose");

const memberSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    role: { type: String, enum: ["admin", "member"], default: "member" },
    status: { type: String, enum: ["pending", "active"], default: "pending" },
  },
  { timestamps: true }
);

memberSchema.index({ userId: 1 });
memberSchema.index({ organizationId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model("OrganizationMember", memberSchema);
