const Quiz = require("../models/Quiz");
const QuizPlay = require("../models/QuizPlay");
const OrganizationMember = require("../models/OrganizationMember");

async function getUserOrganizationId(userId) {
  const member = await OrganizationMember.findOne({ userId, status: "active" }).lean();
  return member ? member.organizationId : null;
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function formatDateKey(d) {
  const x = new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

exports.listQuizzes = async (req, res) => {
  try {
    const isAdmin = req.user.role === "admin";
    const organizationId = isAdmin ? null : await getUserOrganizationId(req.user._id);
    if (!isAdmin && !organizationId) {
      return res.status(403).json({ message: "You must belong to a team to view reports" });
    }

    const quizFilter = isAdmin
      ? {}
      : { $or: [{ organizationId }, { organizationId: null }] };
    const quizzes = await Quiz.find(quizFilter)
      .sort({ createdAt: -1 })
      .select("name timesHosted totalPlayersParticipated sendReportEnabled createdAt")
      .lean();

    const playMatch = organizationId ? { organizationId } : {};
    const lastPlays = await QuizPlay.aggregate([
      { $match: playMatch },
      { $sort: { finishedAt: -1 } },
      {
        $group: {
          _id: "$quizId",
          lastPlayedAt: { $first: "$finishedAt" },
          lastParticipantCount: { $first: "$participantCount" },
        },
      },
    ]);
    const lastPlayMap = new Map(lastPlays.map((p) => [String(p._id), p]));

    const out = quizzes.map((q) => {
      const lp = lastPlayMap.get(String(q._id));
      return {
        _id: q._id,
        name: q.name,
        timesHosted: q.timesHosted ?? 0,
        totalPlayersParticipated: q.totalPlayersParticipated ?? 0,
        sendReportEnabled: q.sendReportEnabled !== false,
        createdAt: q.createdAt,
        lastPlayedAt: lp ? lp.lastPlayedAt : null,
        lastParticipantCount: lp ? lp.lastParticipantCount : null,
      };
    });

    res.json(out);
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to fetch reports" });
  }
};

exports.getQuizReport = async (req, res) => {
  try {
    const isAdmin = req.user.role === "admin";
    const organizationId = isAdmin ? null : await getUserOrganizationId(req.user._id);
    if (!isAdmin && !organizationId) {
      return res.status(403).json({ message: "You must belong to a team to view reports" });
    }
    const quizId = req.params.quizId;

    const quizFilter = isAdmin
      ? { _id: quizId }
      : { _id: quizId, $or: [{ organizationId }, { organizationId: null }] };
    const quiz = await Quiz.findOne(quizFilter)
      .select("name timesHosted totalPlayersParticipated sendReportEnabled createdAt")
      .lean();
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });

    const now = new Date();
    const from = startOfDay(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000));

    const playFilter = { quizId, finishedAt: { $gte: from, $lte: now } };
    if (organizationId) playFilter.organizationId = organizationId;
    const last7DaysPlays = await QuizPlay.find(playFilter)
      .select("finishedAt participantCount avgScore")
      .sort({ finishedAt: 1 })
      .lean();

    // build 7-day series (date -> plays, participants, avgScore)
    const dayBuckets = new Map();
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(from.getTime() + i * 24 * 60 * 60 * 1000);
      dayBuckets.set(formatDateKey(d), { date: formatDateKey(d), plays: 0, participants: 0, avgScore: 0, _sumAvg: 0 });
    }
    last7DaysPlays.forEach((p) => {
      const key = formatDateKey(p.finishedAt);
      const b = dayBuckets.get(key);
      if (!b) return;
      b.plays += 1;
      b.participants += p.participantCount || 0;
      b._sumAvg += Number(p.avgScore || 0);
    });
    const last7Days = Array.from(dayBuckets.values()).map((b) => ({
      date: b.date,
      plays: b.plays,
      participants: b.participants,
      avgScore: b.plays > 0 ? Number((b._sumAvg / b.plays).toFixed(2)) : 0,
    }));

    const playsQuery = { quizId };
    if (organizationId) playsQuery.organizationId = organizationId;
    const plays = await QuizPlay.find(playsQuery)
      .select("finishedAt startedAt participantCount avgScore participants sendReportEnabled gameCode")
      .sort({ finishedAt: -1 })
      .limit(50)
      .lean();

    // last 7 plays avg scores (for graph)
    const last7Plays = plays.slice(0, 7).reverse().map((p) => ({
      finishedAt: p.finishedAt,
      avgScore: Number((p.avgScore || 0).toFixed(2)),
      participantCount: p.participantCount || 0,
    }));

    res.json({
      quiz: {
        _id: quiz._id,
        name: quiz.name,
        timesHosted: quiz.timesHosted ?? 0,
        totalPlayersParticipated: quiz.totalPlayersParticipated ?? 0,
        sendReportEnabled: quiz.sendReportEnabled !== false,
        createdAt: quiz.createdAt,
      },
      last7Days,
      last7Plays,
      plays: plays.map((p) => ({
        _id: p._id,
        gameCode: p.gameCode,
        startedAt: p.startedAt,
        finishedAt: p.finishedAt,
        participantCount: p.participantCount,
        avgScore: Number((p.avgScore || 0).toFixed(2)),
        sendReportEnabled: p.sendReportEnabled !== false,
        participants: (p.participants || []).map((x) => ({
          name: x.name,
          email: x.email,
          score: x.score,
          total: x.total,
        })),
      })),
    });
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to fetch quiz report" });
  }
};

exports.downloadQuizCsv = async (req, res) => {
  try {
    const isAdmin = req.user.role === "admin";
    const organizationId = isAdmin ? null : await getUserOrganizationId(req.user._id);
    if (!isAdmin && !organizationId) {
      return res.status(403).json({ message: "You must belong to a team to download reports" });
    }
    const quizId = req.params.quizId;

    const quizFilter = isAdmin
      ? { _id: quizId }
      : { _id: quizId, $or: [{ organizationId }, { organizationId: null }] };
    const quiz = await Quiz.findOne(quizFilter)
      .select("name sendReportEnabled")
      .lean();
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });

    const playsQuery = { quizId };
    if (organizationId) playsQuery.organizationId = organizationId;
    const plays = await QuizPlay.find(playsQuery)
      .select("finishedAt gameCode participants sendReportEnabled")
      .sort({ finishedAt: -1 })
      .lean();

    const includeEmail = quiz.sendReportEnabled !== false;

    const header = includeEmail
      ? ["playFinishedAt", "gameCode", "playerName", "playerEmail", "score", "total"]
      : ["playFinishedAt", "gameCode", "playerName", "score", "total"];

    const rows = [header.join(",")];
    plays.forEach((p) => {
      const when = p.finishedAt ? new Date(p.finishedAt).toISOString() : "";
      const code = p.gameCode || "";
      (p.participants || []).forEach((pp) => {
        const cols = includeEmail
          ? [when, code, pp.name || "", (pp.email || "").toLowerCase(), String(pp.score ?? 0), String(pp.total ?? 0)]
          : [when, code, pp.name || "", String(pp.score ?? 0), String(pp.total ?? 0)];
        rows.push(cols.map(csvEscape).join(","));
      });
      if ((p.participants || []).length === 0) {
        const cols = includeEmail ? [when, code, "", "", "0", "0"] : [when, code, "", "0", "0"];
        rows.push(cols.map(csvEscape).join(","));
      }
    });

    const csv = rows.join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=\"${safeFilename(quiz.name)}-report.csv\"`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to download CSV" });
  }
};

function csvEscape(val) {
  const s = String(val ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function safeFilename(name) {
  return String(name || "quiz")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

