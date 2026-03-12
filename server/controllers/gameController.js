const OrganizationMember = require("../models/OrganizationMember");
const QuizPlay = require("../models/QuizPlay");
const { createGame: createGameSession, getGame, getResults, recordLead } = require("../gameStore");
const { sendEmail } = require("../utils/email");

function buildReportEmail(game, playerName) {
  const results = getResults(game.code);
  if (!results) return null;

  const bg = "#f8fafc";
  const cardBg = "#ffffff";
  const primary = "#2563eb";
  const primaryDark = "#1d4ed8";
  const text = "#1e293b";
  const textMuted = "#64748b";
  const border = "#e2e8f0";
  const headerBg = "#1e293b";
  const accent = "#22c55e";

  let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,sans-serif;background-color:${bg};color:${text};line-height:1.5;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${bg};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:${cardBg};border-radius:12px;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1),0 2px 4px -2px rgba(0,0,0,0.1);overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(135deg,${primary} 0%,${primaryDark} 100%);padding:24px 28px;text-align:center;">
              <p style="margin:0 0 4px 0;font-size:12px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.9);">Quiz Report</p>
              <h1 style="margin:0;font-size:24px;font-weight:700;color:#ffffff;">${escapeHtml(results.quizName)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 28px 20px 28px;">
              <h2 style="margin:0 0 16px 0;font-size:16px;font-weight:600;color:${headerBg};border-bottom:2px solid ${primary};padding-bottom:8px;">Your Result</h2>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid ${border};border-radius:8px;overflow:hidden;">
                <tr>
                  <th style="background-color:${headerBg};color:#fff;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;padding:12px 16px;text-align:left;">Rank</th>
                  <th style="background-color:${headerBg};color:#fff;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;padding:12px 16px;text-align:left;">Name</th>
                  <th style="background-color:${headerBg};color:#fff;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;padding:12px 16px;text-align:right;">Score</th>
                </tr>`;

  const allResults = Array.isArray(results.results) ? results.results : [];
  const totalPlayers = allResults.length;
  const nameKey = String(playerName || "").trim().toLowerCase();
  let playerRow = null;
  let playerRank = null;

  if (nameKey && totalPlayers > 0) {
    const idx = allResults.findIndex(
      (r) => String(r.name || "").trim().toLowerCase() === nameKey
    );
    if (idx >= 0) {
      playerRow = allResults[idx];
      playerRank = idx + 1;
    }
  }

  if (playerRow) {
    const rowBg = "#ffffff";
    const rankLabel =
      totalPlayers > 0 ? `${playerRank} of ${totalPlayers}` : String(playerRank);
    html += `
                <tr>
                  <td style="background-color:${rowBg};padding:12px 16px;border-top:1px solid ${border};font-size:14px;font-weight:600;color:${text};">${rankLabel}</td>
                  <td style="background-color:${rowBg};padding:12px 16px;border-top:1px solid ${border};font-size:14px;color:${text};">${escapeHtml(playerRow.name)}</td>
                  <td style="background-color:${rowBg};padding:12px 16px;border-top:1px solid ${border};font-size:14px;font-weight:600;color:${text};text-align:right;">${playerRow.score} / ${playerRow.total}</td>
                </tr>`;
  } else {
    html += `
                <tr>
                  <td colspan="3" style="background-color:#ffffff;padding:12px 16px;border-top:1px solid ${border};font-size:13px;color:${textMuted};">
                    Your detailed score could not be determined, but the correct answers are listed below.
                  </td>
                </tr>`;
  }

  html += `
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 28px 28px;">
              <h2 style="margin:0 0 16px 0;font-size:16px;font-weight:600;color:${headerBg};border-bottom:2px solid ${primary};padding-bottom:8px;">Correct Answers</h2>`;

  (game.quiz.questions || []).forEach((q, idx) => {
    const correctText = (q.options && q.options[q.correctAnswerIndex]) ? q.options[q.correctAnswerIndex] : "—";
    const letter = String.fromCharCode(65 + (q.correctAnswerIndex ?? 0));
    html += `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;border:1px solid ${border};border-radius:8px;overflow:hidden;background-color:#f8fafc;">
                <tr>
                  <td style="padding:14px 16px;border-bottom:1px solid ${border};">
                    <span style="display:inline-block;background-color:${primary};color:#fff;font-size:11px;font-weight:700;padding:4px 8px;border-radius:4px;">Q${idx + 1}</span>
                    <span style="margin-left:10px;font-size:14px;font-weight:500;color:${text};">${escapeHtml(q.questionText || "")}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;background-color:#ffffff;">
                    <span style="font-size:13px;color:${textMuted};">Correct answer:</span>
                    <span style="font-size:14px;font-weight:600;color:${accent};margin-left:6px;">${letter}) ${escapeHtml(correctText)}</span>
                  </td>
                </tr>
              </table>`;
  });

  html += `
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px;background-color:${bg};border-top:1px solid ${border};text-align:center;">
              <p style="margin:0;font-size:12px;color:${textMuted};">Report generated by Brain Box</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return html;
}

function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

exports.sendReport = async (req, res) => {
  try {
    const { code, email, name } = req.body;
    if (!code || !email || !String(email).trim()) {
      return res.status(400).json({ message: "Game code and email are required" });
    }
    // name is optional (for lead capture on player side)
    const game = getGame(code);
    if (!game) {
      return res.status(404).json({ message: "Game not found or session expired" });
    }
    if (game.status !== "finished") {
      return res.status(400).json({ message: "Report is available only after the game has finished" });
    }
    const html = buildReportEmail(game, name);
    if (!html) {
      return res.status(500).json({ message: "Could not build report" });
    }
    await sendEmail({
      to: String(email).trim(),
      subject: `Quiz Report — ${game.quiz.name}`,
      html,
    });
    if (game.quiz.sendReportEnabled !== false) {
      recordLead(code, name, email);
      // Persist email against participant name in the saved QuizPlay so reports show it
      const cleanName = String(name || "").trim();
      const cleanEmail = String(email || "").trim().toLowerCase();
      if (cleanName && cleanEmail) {
        const play = await QuizPlay.findOne({ gameCode: code }).sort({ finishedAt: -1 }).lean();
        if (play && play.participants && play.participants.length > 0) {
          const nameLower = cleanName.toLowerCase();
          const idx = play.participants.findIndex(
            (p) => String(p.name || "").trim().toLowerCase() === nameLower
          );
          if (idx !== -1) {
            await QuizPlay.updateOne(
              { _id: play._id },
              { $set: { [`participants.${idx}.email`]: cleanEmail } }
            );
          }
        }
      }
    }
    res.json({ message: "Report sent to your email" });
  } catch (error) {
    console.error("Send report error:", error);
    res.status(500).json({ message: error.message || "Failed to send report" });
  }
};

async function getUserOrganizationId(userId) {
  const member = await OrganizationMember.findOne({ userId, status: "active" }).lean();
  return member ? member.organizationId : null;
}

exports.createGame = async (req, res) => {
  try {
    const { quizId } = req.body;
    if (!quizId) {
      return res.status(400).json({ message: "Quiz ID is required" });
    }
    const isAdmin = req.user.role === "admin";
    const organizationId = isAdmin ? null : await getUserOrganizationId(req.user._id);
    if (!isAdmin && !organizationId) {
      return res.status(403).json({ message: "You must belong to a team to host a game" });
    }
    const game = await createGameSession(quizId, req.user._id, organizationId);
    if (!game) {
      return res.status(404).json({ message: "Quiz not found or you don't have access" });
    }
    res.status(201).json({ code: game.code, quizName: game.quiz.name });
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to create game" });
  }
};

exports.getGameInfo = async (req, res) => {
  try {
    const { code } = req.params;
    const game = getGame(code);
    if (!game) {
      return res.status(404).json({ message: "Game not found" });
    }
    res.json({
      code: game.code,
      quizName: game.quiz.name,
      status: game.status,
      participantCount: game.participants.length,
    });
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to fetch game" });
  }
};
