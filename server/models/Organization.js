const mongoose = require("mongoose");

const orgSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    orgId: { type: String, required: true, unique: true, trim: true, uppercase: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Organization", orgSchema);
