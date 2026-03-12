const mongoose = require("mongoose");

const participantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, default: "", trim: true, lowercase: true },
    score: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const quizPlaySchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true },
    quizId: { type: mongoose.Schema.Types.ObjectId, ref: "Quiz", required: true },
    quizName: { type: String, required: true, trim: true },
    sendReportEnabled: { type: Boolean, default: true },
    hostedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    gameCode: { type: String, required: true, trim: true },
    startedAt: { type: Date, required: true },
    finishedAt: { type: Date, required: true },
    participantCount: { type: Number, required: true, min: 0 },
    avgScore: { type: Number, required: true, min: 0 },
    participants: { type: [participantSchema], default: [] },
  },
  { timestamps: true }
);

quizPlaySchema.index({ organizationId: 1, quizId: 1, finishedAt: -1 });
quizPlaySchema.index({ organizationId: 1, finishedAt: -1 });

module.exports = mongoose.model("QuizPlay", quizPlaySchema);

