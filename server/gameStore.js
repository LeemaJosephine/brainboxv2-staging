const Quiz = require("./models/Quiz");

const games = new Map();
const CODE_LENGTH = 4;
const CODE_MAX = 10 ** CODE_LENGTH - 1;
const CODE_MIN = 10 ** (CODE_LENGTH - 1);

function generateCode() {
  let code;
  do {
    code = String(Math.floor(CODE_MIN + Math.random() * (CODE_MAX - CODE_MIN + 1)));
  } while (games.has(code));
  return code;
}

async function createGame(quizId, createdByUserId, organizationId) {
  const query =
    organizationId
      ? { _id: quizId, $or: [{ organizationId }, { organizationId: null }] }
      : { _id: quizId };
  const quiz = await Quiz.findOne(query).lean();
  if (!quiz) return null;
  const code = generateCode();
  const game = {
    code,
    quizId: quiz._id.toString(),
    organizationId: organizationId ? organizationId.toString() : null,
    quiz: {
      name: quiz.name,
      durationPerQuestion: quiz.durationPerQuestion ?? 30,
      sendReportEnabled: quiz.sendReportEnabled !== false,
      questions: (quiz.questions || []).map((q) => ({
        questionText: q.questionText,
        imageUrl: q.imageUrl && String(q.imageUrl).trim() ? String(q.imageUrl).trim() : "",
        options: q.options || [],
        correctAnswerIndex: q.correctAnswerIndex ?? 0,
      })),
    },
    createdBy: createdByUserId.toString(),
    hostSocketId: null,
    status: "waiting",
    participants: [],
    leads: {}, // nameKey -> { name, email, createdAt }
    createdAt: Date.now(),
    currentQuestionIndex: 0,
    questionStartTime: null,
    questionTimer: null,
  };
  games.set(code, game);
  return game;
}

function getGame(code) {
  return games.get(code) || null;
}

function addParticipant(code, socketId, name) {
  const game = games.get(code);
  if (!game || game.status !== "waiting") return false;
  if (game.participants.some((p) => p.socketId === socketId)) return true;
  game.participants.push({
    socketId,
    name: (name || "Player").trim() || "Player",
    score: 0,
    answers: [],
  });
  return true;
}

function normalizeName(name) {
  return String(name || "").trim().toLowerCase();
}

function recordLead(code, name, email) {
  const game = games.get(code);
  if (!game) return false;
  const nameKey = normalizeName(name);
  const cleanEmail = String(email || "").trim().toLowerCase();
  if (!nameKey || !cleanEmail) return false;
  game.leads[nameKey] = { name: String(name || "").trim(), email: cleanEmail, createdAt: Date.now() };
  return true;
}

function setHost(code, socketId) {
  const game = games.get(code);
  if (!game) return false;
  game.hostSocketId = socketId;
  return true;
}

function isHost(code, socketId) {
  const game = games.get(code);
  return game && game.hostSocketId === socketId;
}

function recordAnswer(code, socketId, questionIndex, optionIndex) {
  const game = games.get(code);
  if (!game || game.status !== "playing") return false;
  const participant = game.participants.find((p) => p.socketId === socketId);
  if (!participant) return false;
  if (participant.answers.some((a) => a.questionIndex === questionIndex)) return true;
  const q = game.quiz.questions[questionIndex];
  const correct = q && q.correctAnswerIndex === optionIndex;
  participant.answers.push({ questionIndex, optionIndex, correct });
  if (correct) participant.score += 1;
  return true;
}

function startGame(code) {
  const game = games.get(code);
  if (!game || game.status !== "waiting") return false;
  game.status = "playing";
  game.currentQuestionIndex = 0;
  game.questionStartTime = Date.now();
  return true;
}

function getCurrentQuestion(code) {
  const game = games.get(code);
  if (!game || game.status !== "playing") return null;
  const q = game.quiz.questions[game.currentQuestionIndex];
  if (!q) return null;
  return {
    questionIndex: game.currentQuestionIndex,
    questionText: q.questionText,
    imageUrl: q.imageUrl || "",
    options: q.options,
    durationPerQuestion: game.quiz.durationPerQuestion,
    startTime: game.questionStartTime,
  };
}

function advanceQuestion(code) {
  const game = games.get(code);
  if (!game) return null;
  game.currentQuestionIndex += 1;
  if (game.currentQuestionIndex >= game.quiz.questions.length) {
    game.status = "finished";
    return "finished";
  }
  game.questionStartTime = Date.now();
  return getCurrentQuestion(code);
}

function getResults(code) {
  const game = games.get(code);
  if (!game) return null;
  const results = game.participants.map((p) => ({
    name: p.name,
    score: p.score,
    total: game.quiz.questions.length,
  }));
  results.sort((a, b) => b.score - a.score);
  return { quizName: game.quiz.name, results };
}

function clearQuestionTimer(code) {
  const game = games.get(code);
  if (game && game.questionTimer) {
    clearTimeout(game.questionTimer);
    game.questionTimer = null;
  }
}

function setQuestionTimer(code, callback) {
  const game = games.get(code);
  if (!game) return;
  clearQuestionTimer(code);
  const durationMs = (game.quiz.durationPerQuestion || 30) * 1000;
  game.questionTimer = setTimeout(() => callback(), durationMs);
}

function haveAllParticipantsAnswered(code, questionIndex) {
  const game = games.get(code);
  if (!game || game.status !== "playing" || game.participants.length === 0) return false;
  return game.participants.every((p) =>
    p.answers.some((a) => a.questionIndex === questionIndex)
  );
}

function removeParticipant(code, socketId) {
  const game = games.get(code);
  if (!game) return;
  game.participants = game.participants.filter((p) => p.socketId !== socketId);
}

module.exports = {
  createGame,
  getGame,
  recordLead,
  addParticipant,
  setHost,
  isHost,
  recordAnswer,
  startGame,
  getCurrentQuestion,
  advanceQuestion,
  getResults,
  clearQuestionTimer,
  setQuestionTimer,
  haveAllParticipantsAnswered,
  removeParticipant,
};
