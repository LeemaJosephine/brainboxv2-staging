const {
  getGame,
  addParticipant,
  setHost,
  isHost,
  recordAnswer,
  startGame,
  getCurrentQuestion,
  advanceQuestion,
  getResults,
  setQuestionTimer,
  clearQuestionTimer,
  haveAllParticipantsAnswered,
  removeParticipant,
} = require("./gameStore");
const Quiz = require("./models/Quiz");
const QuizPlay = require("./models/QuizPlay");

async function endCurrentQuestionAndAdvance(io, code) {
  const g = getGame(code);
  if (!g || g.status !== "playing") return;
  clearQuestionTimer(code);
  const idx = g.currentQuestionIndex;
  const correctIdx = g.quiz.questions[idx]?.correctAnswerIndex;
  io.to(code).emit("question-end", { questionIndex: idx, correctAnswerIndex: correctIdx });
  const next = advanceQuestion(code);
  if (next === "finished") {
    const participantCount = g.participants.length;
    Quiz.findByIdAndUpdate(g.quizId, {
      $inc: { timesHosted: 1, totalPlayersParticipated: participantCount },
    }).catch((err) => console.error("Failed to update quiz stats:", err));
    try {
      const total = g.quiz.questions.length;
      const finishedAt = new Date();
      const startedAt = new Date(g.createdAt || Date.now());
      const avgScore =
        participantCount > 0
          ? g.participants.reduce((sum, p) => sum + (p.score || 0), 0) / participantCount
          : 0;
      const participants = g.participants.map((p) => {
        const lead = g.leads && g.leads[String(p.name || "").trim().toLowerCase()];
        return {
          name: p.name,
          email: g.quiz.sendReportEnabled !== false && lead && lead.email ? lead.email : "",
          score: p.score || 0,
          total,
        };
      });
      if (g.organizationId) {
        await QuizPlay.create({
          organizationId: g.organizationId,
          quizId: g.quizId,
          quizName: g.quiz.name,
          sendReportEnabled: g.quiz.sendReportEnabled !== false,
          hostedBy: g.createdBy,
          gameCode: g.code,
          startedAt,
          finishedAt,
          participantCount,
          avgScore,
          participants,
        });
      }
    } catch (e) {
      console.error("Failed to save quiz play:", e);
    }
    io.to(code).emit("game-finished", {
      results: getResults(code),
      sendReportEnabled: g.quiz.sendReportEnabled !== false,
    });
    return;
  }
  io.to(code).emit("next-question", { question: next });
  scheduleQuestionTimer(io, code);
}

function scheduleQuestionTimer(io, code) {
  const game = getGame(code);
  if (!game || game.status !== "playing") return;
  setQuestionTimer(code, () => endCurrentQuestionAndAdvance(io, code));
}

function registerSocket(io) {
  io.on("connection", (socket) => {
    socket.on("host-join", (code) => {
      const game = getGame(code);
      if (!game) {
        socket.emit("error", { message: "Game not found" });
        return;
      }
      socket.join(code);
      setHost(code, socket.id);
      socket.emit("host-joined", { code, quizName: game.quiz.name });
      io.to(code).emit("participants-updated", {
        participants: game.participants.map((p) => ({ name: p.name })),
      });
    });

    socket.on("join-game", ({ code, playerName }) => {
      const game = getGame(code);
      if (!game) {
        socket.emit("error", { message: "Game not found" });
        return;
      }
      if (game.status !== "waiting") {
        socket.emit("error", { message: "Game has already started" });
        return;
      }
      const added = addParticipant(code, socket.id, playerName);
      if (!added) {
        socket.emit("error", { message: "Could not join game" });
        return;
      }
      socket.join(code);
      socket.gameCode = code;
      socket.emit("joined", { code, quizName: game.quiz.name });
      io.to(code).emit("participants-updated", {
        participants: game.participants.map((p) => ({ name: p.name })),
      });
    });

    socket.on("start-game", (code) => {
      if (!isHost(code, socket.id)) {
        socket.emit("error", { message: "Only host can start the game" });
        return;
      }
      const game = getGame(code);
      if (!game || game.participants.length === 0) {
        socket.emit("error", { message: "Play cannot begin without any players. At least 1 player must join the waiting room." });
        return;
      }
      const started = startGame(code);
      if (!started) {
        socket.emit("error", { message: "Could not start game" });
        return;
      }
      const question = getCurrentQuestion(code);
      io.to(code).emit("game-started", { question });
      scheduleQuestionTimer(io, code);
    });

    socket.on("submit-answer", ({ code, questionIndex, optionIndex }) => {
      const recorded = recordAnswer(code, socket.id, questionIndex, optionIndex);
      if (recorded && haveAllParticipantsAnswered(code, questionIndex)) {
        endCurrentQuestionAndAdvance(io, code);
      }
    });

    socket.on("disconnect", () => {
      const code = socket.gameCode;
      if (code) {
        removeParticipant(code, socket.id);
        const game = getGame(code);
        if (game) {
          io.to(code).emit("participants-updated", {
            participants: game.participants.map((p) => ({ name: p.name })),
          });
        }
      }
    });
  });
}

module.exports = { registerSocket };
