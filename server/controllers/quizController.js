const Quiz = require("../models/Quiz");
const QuizPlay = require("../models/QuizPlay");
const OrganizationMember = require("../models/OrganizationMember");

async function getUserTeamId(userId) {
  const member = await OrganizationMember.findOne({ userId, status: "active" }).lean();
  return member ? member.organizationId : null;
}

/**
 * Admin-created quizzes have organizationId null (visible to all teams).
 * Team member/manager-created quizzes have organizationId set (visible only to that team).
 */
exports.createQuiz = async (req, res) => {
  try {
    const isAdmin = req.user.role === "admin";
    let organizationId = null;
    if (!isAdmin) {
      organizationId = await getUserTeamId(req.user._id);
      if (!organizationId) {
        return res.status(403).json({ message: "You must belong to a team to create quizzes" });
      }
    }
    const { name, category, durationPerQuestion, sendReportEnabled, questions } = req.body;
    if (!name || !Array.isArray(questions)) {
      return res.status(400).json({ message: "Quiz name and questions are required" });
    }
    const quiz = await Quiz.create({
      name,
      category: category || null,
      durationPerQuestion: durationPerQuestion ?? 30,
      sendReportEnabled: sendReportEnabled !== false,
      questions: questions.map((q) => ({
        questionText: q.questionText,
        imageUrl: q.imageUrl && String(q.imageUrl).trim() ? String(q.imageUrl).trim() : "",
        options: q.options || [],
        correctAnswerIndex: q.correctAnswerIndex >= 0 ? q.correctAnswerIndex : 0,
      })),
      organizationId,
      createdBy: req.user._id,
    });
    const populated = await Quiz.findById(quiz._id).populate("category", "name").lean();
    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to create quiz" });
  }
};

exports.getQuizzes = async (req, res) => {
  try {
    const isAdmin = req.user.role === "admin";
    if (isAdmin) {
      const quizzes = await Quiz.find({})
        .sort({ createdAt: -1 })
        .populate("category", "name")
        .select("-__v")
        .lean();
      return res.json(quizzes);
    }
    const teamId = await getUserTeamId(req.user._id);
    if (!teamId) {
      return res.status(403).json({ message: "You must belong to a team to view quizzes" });
    }
    const quizzes = await Quiz.find({
      $or: [{ organizationId: teamId }, { organizationId: null }],
    })
      .sort({ createdAt: -1 })
      .populate("category", "name")
      .select("-__v")
      .lean();
    res.json(quizzes);
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to fetch quizzes" });
  }
};

exports.getQuizById = async (req, res) => {
  try {
    const isAdmin = req.user.role === "admin";
    let quiz;
    if (isAdmin) {
      quiz = await Quiz.findOne({ _id: req.params.id }).populate("category", "name").lean();
    } else {
      const teamId = await getUserTeamId(req.user._id);
      if (!teamId) {
        return res.status(403).json({ message: "You must belong to a team to view quizzes" });
      }
      quiz = await Quiz.findOne({
        _id: req.params.id,
        $or: [{ organizationId: teamId }, { organizationId: null }],
      })
        .populate("category", "name")
        .lean();
    }
    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }
    res.json(quiz);
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to fetch quiz" });
  }
};

exports.updateQuiz = async (req, res) => {
  try {
    const isAdmin = req.user.role === "admin";
    const { name, category, durationPerQuestion, sendReportEnabled, questions } = req.body;
    let quiz;
    if (isAdmin) {
      quiz = await Quiz.findOne({ _id: req.params.id });
    } else {
      const teamId = await getUserTeamId(req.user._id);
      if (!teamId) {
        return res.status(403).json({ message: "You must belong to a team to update quizzes" });
      }
      quiz = await Quiz.findOne({
        _id: req.params.id,
        createdBy: req.user._id,
        $or: [{ organizationId: teamId }, { organizationId: null }],
      });
    }
    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }
    if (name != null) quiz.name = name;
    if (category !== undefined) quiz.category = category || null;
    if (durationPerQuestion != null) quiz.durationPerQuestion = durationPerQuestion;
    if (typeof sendReportEnabled === "boolean") quiz.sendReportEnabled = sendReportEnabled;
    if (Array.isArray(questions)) {
      quiz.questions = questions.map((q) => ({
        questionText: q.questionText,
        imageUrl: q.imageUrl && String(q.imageUrl).trim() ? String(q.imageUrl).trim() : "",
        options: q.options || [],
        correctAnswerIndex: q.correctAnswerIndex >= 0 ? q.correctAnswerIndex : 0,
      }));
    }
    await quiz.save();
    const populated = await Quiz.findById(quiz._id).populate("category", "name").lean();
    res.json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to update quiz" });
  }
};

exports.deleteQuiz = async (req, res) => {
  try {
    const isAdmin = req.user.role === "admin";
    let quiz;
    if (isAdmin) {
      quiz = await Quiz.findOne({ _id: req.params.id });
    } else {
      const teamId = await getUserTeamId(req.user._id);
      if (!teamId) {
        return res.status(403).json({ message: "You must belong to a team to delete quizzes" });
      }
      quiz = await Quiz.findOne({
        _id: req.params.id,
        $or: [{ organizationId: teamId }, { organizationId: null, createdBy: req.user._id }],
      });
    }
    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }
    await QuizPlay.deleteMany({ quizId: quiz._id });
    await Quiz.deleteOne({ _id: quiz._id });
    res.json({ message: "Quiz deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to delete quiz" });
  }
};
