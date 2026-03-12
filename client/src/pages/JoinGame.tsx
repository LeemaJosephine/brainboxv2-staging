import { Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { useSendReportMutation } from "../services/gameApi";
import { apiBaseUrl } from "../env";

type View = "form" | "waiting" | "playing" | "finished";

interface QuestionData {
  questionIndex: number;
  questionText: string;
  imageUrl?: string;
  options: string[];
  durationPerQuestion: number;
  startTime: number;
}

interface ResultRow {
  name: string;
  score: number;
  total: number;
}

interface GameResults {
  quizName: string;
  results: ResultRow[];
}

export default function JoinGame() {
  const [view, setView] = useState<View>("form");
  const [pin, setPin] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [quizName, setQuizName] = useState("");
  const [participants, setParticipants] = useState<string[]>([]);
  const [question, setQuestion] = useState<QuestionData | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [results, setResults] = useState<GameResults | null>(null);
  const [error, setError] = useState("");
  const [answered, setAnswered] = useState(false);
  const [leadSubmitted, setLeadSubmitted] = useState(false);
  const [sendReportEnabled, setSendReportEnabled] = useState(true);
  const [leadName, setLeadName] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [reportMessage, setReportMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const codeRef = useRef("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [sendReport, { isLoading: reportSending }] = useSendReportMutation();

  useEffect(() => {
    const socket = io(apiBaseUrl, { transports: ["websocket", "polling"] });
    socketRef.current = socket;

    socket.on("error", (data: { message: string }) => setError(data.message));
    socket.on("joined", (data: { code: string; quizName: string }) => {
      codeRef.current = data.code;
      setQuizName(data.quizName);
      setError("");
      setView("waiting");
    });
    socket.on("participants-updated", (data: { participants: { name: string }[] }) => {
      setParticipants(data.participants.map((p) => p.name));
    });
    socket.on("game-started", (data: { question: QuestionData }) => {
      setQuestion(data.question);
      setAnswered(false);
      setView("playing");
      setTimeLeft(data.question.durationPerQuestion);
    });
    socket.on("question-end", () => {
      setQuestion((q) => (q ? { ...q, options: [] } : null));
      setTimeLeft(0);
      if (timerRef.current) clearInterval(timerRef.current);
    });
    socket.on("next-question", (data: { question: QuestionData }) => {
      setQuestion(data.question);
      setAnswered(false);
      setTimeLeft(data.question.durationPerQuestion);
    });
    socket.on("game-finished", (data: { results: GameResults; sendReportEnabled?: boolean }) => {
      setResults(data.results);
      const reportEnabled = data.sendReportEnabled !== false;
      setSendReportEnabled(reportEnabled);
      setLeadSubmitted(!reportEnabled);
      setLeadEmail("");
      setReportMessage(null);
      setView("finished");
      setQuestion(null);
      if (timerRef.current) clearInterval(timerRef.current);
    });

    return () => {
      socket.off("error").off("joined").off("participants-updated").off("game-started").off("question-end").off("next-question").off("game-finished");
      socket.disconnect();
      socketRef.current = null;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (view !== "playing" || !question || timeLeft <= 0) return;
    timerRef.current = setInterval(() => setTimeLeft((t) => Math.max(0, t - 1)), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [view, question, timeLeft]);

  useEffect(() => {
    if (view === "finished" && playerName && !leadName) setLeadName(playerName);
  }, [view, playerName, leadName]);

  const resetToNewGameForm = () => {
    setView("form");
    setPin("");
    setPlayerName("");
    setQuizName("");
    setParticipants([]);
    setQuestion(null);
    setResults(null);
    setError("");
    setAnswered(false);
    setLeadSubmitted(false);
    setLeadName("");
    setLeadEmail("");
    setReportMessage(null);
    codeRef.current = "";
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const code = pin.trim();
    if (!code || !playerName.trim()) {
      setError("Enter game pin and your name");
      return;
    }
    socketRef.current?.emit("join-game", { code, playerName: playerName.trim() });
  };

  const handleSubmitAnswer = (optionIndex: number) => {
    if (answered || !question) return;
    setAnswered(true);
    socketRef.current?.emit("submit-answer", { code: codeRef.current, questionIndex: question.questionIndex, optionIndex });
  };

  const cardClass = "rounded-xl border border-slate-600 bg-slate-800/60 backdrop-blur p-6";
  const inputClass = "w-full rounded border border-slate-500 bg-slate-700/50 px-3 py-2 text-white placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none";

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-950 via-black/40 to-slate-950 px-4 py-8">
      <div className={`w-full flex flex-col ${view === "playing" ? "flex-1 min-h-0 max-w-4xl mx-auto" : "max-w-lg mx-auto"}`}>
        <h1 className="text-2xl font-bold text-white mb-6 text-center shrink-0">Join Game</h1>

        {view === "form" && (
          <form onSubmit={handleJoin} className={cardClass}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-1">Game PIN</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  className={inputClass}
                  placeholder="4-digit code"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-1">Your name</label>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  className={inputClass}
                  placeholder="Enter your name"
                />
              </div>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <button type="submit" className="w-full rounded-lg bg-blue-600 py-2.5 text-white font-medium hover:bg-blue-500 transition-colors">
                Join
              </button>
            </div>
          </form>
        )}

        {view === "waiting" && (
          <div className={cardClass}>
            <p className="text-white font-medium mb-1">{quizName}</p>
            <p className="text-slate-400 text-sm mb-4">Waiting for host to start the game...</p>
            <div className="flex items-center gap-2 text-slate-300 mb-2">
              <Users className="h-5 w-5" />
              <span className="font-medium">{participants.length} player{participants.length !== 1 ? "s" : ""} in lobby</span>
            </div>
            <ul className="space-y-1 text-slate-400 text-sm">
              {participants.map((name, i) => (
                <li key={i}>{name}</li>
              ))}
            </ul>
          </div>
        )}

        {view === "playing" && question && (
          <div className={`${cardClass} flex-1 flex flex-col min-h-0 min-h-[70vh]`}>
            <div className="flex justify-between items-center mb-3 shrink-0">
              <span className="text-slate-400 text-sm">Question {question.questionIndex + 1}</span>
              <span className={`font-mono text-lg font-semibold ${timeLeft <= 5 ? "text-red-400" : "text-white"}`}>{timeLeft}s</span>
            </div>
            <p className="text-white font-medium mb-3 shrink-0">{question.questionText}</p>
            {question.imageUrl?.trim() && (
              <div className="flex-1 min-h-[200px] rounded-lg border border-slate-600 bg-slate-800/50 overflow-hidden flex items-center justify-center mb-4">
                <img
                  src={question.imageUrl}
                  alt="Question"
                  className="w-full h-full object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              </div>
            )}
            <div className="space-y-2 shrink-0">
              {question.options.map((opt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSubmitAnswer(idx)}
                  disabled={answered}
                  className={`w-full text-left rounded-lg border-2 px-4 py-3 transition-colors ${
                    answered ? "border-slate-600 bg-slate-700/30 text-slate-400 cursor-default" : "border-slate-500 bg-slate-700/50 text-white hover:border-blue-500"
                  }`}
                >
                  {opt || `Option ${idx + 1}`}
                </button>
              ))}
            </div>
            {answered && <p className="text-slate-400 text-sm mt-3 shrink-0">Answer submitted. Waiting for next question...</p>}
          </div>
        )}

        {view === "finished" && results && (
          <div className={cardClass}>
            {sendReportEnabled && !leadSubmitted ? (
              <>
                <h2 className="text-lg font-semibold text-white mb-2">Get your results</h2>
                <p className="text-slate-300 text-sm mb-4">
                  Enter your name and email to receive the quiz report and correct answers. Your results will be shown after you submit.
                </p>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setReportMessage(null);
                    const name = leadName.trim();
                    const email = leadEmail.trim();
                    if (!name || !email) {
                      setReportMessage({ type: "error", text: "Please enter your name and email." });
                      return;
                    }
                    try {
                      await sendReport({ code: codeRef.current, email, name }).unwrap();
                      setReportMessage({ type: "success", text: "Report sent! Check your inbox." });
                      setLeadSubmitted(true);
                    } catch (err: unknown) {
                      const msg = err && typeof err === "object" && "data" in err && typeof (err as { data?: { message?: string } }).data?.message === "string"
                        ? (err as { data: { message: string } }).data.message
                        : "Failed to send report.";
                      setReportMessage({ type: "error", text: msg });
                    }
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Name</label>
                    <input
                      type="text"
                      value={leadName}
                      onChange={(e) => setLeadName(e.target.value)}
                      placeholder="Your name"
                      className={inputClass}
                      disabled={reportSending}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
                    <input
                      type="email"
                      value={leadEmail}
                      onChange={(e) => setLeadEmail(e.target.value)}
                      placeholder="Your email"
                      className={inputClass}
                      disabled={reportSending}
                    />
                  </div>
                  {reportMessage && (
                    <p className={`text-sm ${reportMessage.type === "success" ? "text-emerald-400" : "text-red-400"}`}>
                      {reportMessage.text}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={reportSending}
                    className="w-full rounded-lg bg-blue-600 py-2.5 text-white font-medium hover:bg-blue-500 disabled:opacity-50 transition-colors"
                  >
                    {reportSending ? "Sending..." : "Send report"}
                  </button>
                </form>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold text-white mb-2">Results — {results.quizName}</h2>
                <div className="rounded-lg border border-slate-600 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-700/50 border-b border-slate-600">
                        <th className="text-left text-slate-300 font-medium px-4 py-3">Rank</th>
                        <th className="text-left text-slate-300 font-medium px-4 py-3">Name</th>
                        <th className="text-right text-slate-300 font-medium px-4 py-3">Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.results.map((row, i) => (
                        <tr key={i} className="border-b border-slate-600/80 last:border-b-0">
                          <td className="px-4 py-3 text-white font-medium">{i + 1}</td>
                          <td className="px-4 py-3 text-slate-200">{row.name}</td>
                          <td className="px-4 py-3 text-right text-white font-medium">{row.score} / {row.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {reportMessage?.type === "success" && (
                  <p className="mt-4 text-sm text-emerald-400">{reportMessage.text}</p>
                )}
                <button
                  type="button"
                  onClick={resetToNewGameForm}
                  className="mt-4 w-full rounded-lg border border-slate-500 py-2.5 text-slate-200 font-medium hover:bg-slate-700 transition-colors"
                >
                  Join another game
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
