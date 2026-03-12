const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema(
  {
    questionText: { type: String, required: true, trim: true },
    imageUrl: { type: String, default: "", trim: true },
    options: [{ type: String, trim: true }],
    correctAnswerIndex: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const quizSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null },
    durationPerQuestion: { type: Number, required: true, min: 5, max: 300, default: 30 },
    sendReportEnabled: { type: Boolean, default: true },
    questions: [questionSchema],
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    timesHosted: { type: Number, default: 0 },
    totalPlayersParticipated: { type: Number, default: 0 },
  },
  { timestamps: true }
);

quizSchema.index({ organizationId: 1 });

module.exports = mongoose.model("Quiz", quizSchema);
