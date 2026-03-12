import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { io, type Socket } from "socket.io-client";
import { Users, Copy, Play } from "lucide-react";
import { apiBaseUrl } from "../env";

type View = "connecting" | "waiting" | "playing" | "finished";

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

export default function HostGame() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [view, setView] = useState<View>("connecting");
  const [quizName, setQuizName] = useState("");
  const [participants, setParticipants] = useState<string[]>([]);
  const [question, setQuestion] = useState<QuestionData | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [results, setResults] = useState<GameResults | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!code) return;
    const socket = io(apiBaseUrl, { transports: ["websocket", "polling"] });
    socketRef.current = socket;

    socket.on("error", (data: { message: string }) => setError(data.message));
    socket.on("host-joined", (data: { code: string; quizName: string }) => {
      setQuizName(data.quizName);
      setError("");
      setView("waiting");
    });
    socket.on("participants-updated", (data: { participants: { name: string }[] }) => {
      setParticipants(data.participants.map((p) => p.name));
    });
    socket.on("game-started", (data: { question: QuestionData }) => {
      setQuestion(data.question);
      setTimeLeft(data.question.durationPerQuestion);
      setView("playing");
    });
    socket.on("question-end", () => {
      setTimeLeft(0);
      if (timerRef.current) clearInterval(timerRef.current);
    });
    socket.on("next-question", (data: { question: QuestionData }) => {
      setQuestion(data.question);
      setTimeLeft(data.question.durationPerQuestion);
    });
    socket.on("game-finished", (data: { results: GameResults }) => {
      setResults(data.results);
      setView("finished");
      setQuestion(null);
      if (timerRef.current) clearInterval(timerRef.current);
    });

    socket.emit("host-join", code);

    return () => {
      socket.off("error").off("host-joined").off("participants-updated").off("game-started").off("question-end").off("next-question").off("game-finished");
      socket.disconnect();
      socketRef.current = null;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [code]);

  useEffect(() => {
    if (view !== "playing" || !question || timeLeft <= 0) return;
    timerRef.current = setInterval(() => setTimeLeft((t) => Math.max(0, t - 1)), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [view, question, timeLeft]);

  const handleStartGame = () => {
    setError("");
    if (participants.length === 0) {
      setError("Play cannot begin without any players. At least 1 player must join the waiting room.");
      return;
    }
    socketRef.current?.emit("start-game", code);
  };

  const copyPin = () => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const cardClass = "rounded-xl border border-slate-600 bg-slate-800/60 backdrop-blur p-6";

  if (!code) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-black/40 to-slate-950 px-4">
        <p className="text-slate-400">Invalid game code.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-950 via-black/40 to-slate-950 px-4 py-8">
      <div className={`w-full flex flex-col ${view === "playing" ? "flex-1 min-h-0 max-w-4xl mx-auto" : "max-w-lg mx-auto"}`}>
        <h1 className="text-2xl font-bold text-white mb-6 text-center shrink-0">Host Game</h1>

        {view === "connecting" && (
          <div className={cardClass}>
            <p className="text-slate-400 text-center">Connecting...</p>
          </div>
        )}

        {view === "waiting" && (
          <div className={cardClass}>
            <p className="text-white font-medium mb-2">{quizName}</p>
            <p className="text-slate-400 text-sm mb-4">Share the game PIN with players. They can join at /join-game</p>
            <div className="flex items-center gap-3 mb-6">
              <span className="text-3xl font-mono font-bold text-white tracking-widest">{code}</span>
              <button
                type="button"
                onClick={copyPin}
                className="p-2 rounded-lg border border-slate-500 text-slate-300 hover:bg-slate-700 transition-colors"
                title="Copy PIN"
              >
                <Copy className="h-5 w-5" />
              </button>
              {copied && <span className="text-sm text-emerald-400">Copied!</span>}
            </div>
            <div className="flex items-center gap-2 text-slate-300 mb-2">
              <Users className="h-5 w-5" />
              <span className="font-medium">{participants.length} player{participants.length !== 1 ? "s" : ""} in lobby</span>
            </div>
            <ul className="space-y-1 text-slate-400 text-sm mb-6">
              {participants.map((name, i) => (
                <li key={i}>{name}</li>
              ))}
            </ul>
            {error && <p className="text-sm text-red-400 mb-4">{error}</p>}
            <button
              type="button"
              onClick={handleStartGame}
              disabled={participants.length === 0}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2.5 text-white font-medium hover:bg-emerald-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="h-5 w-5" /> Start game
            </button>
            {participants.length === 0 ? (
              <p className="text-amber-400/90 text-xs mt-3 text-center">At least 1 player must join before you can start.</p>
            ) : (
              <p className="text-slate-500 text-xs mt-3 text-center">No new players can join after you start.</p>
            )}
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
            {question.options?.length > 0 && (
              <div className="mt-3 shrink-0">
                <p className="text-slate-400 text-xs font-medium uppercase tracking-wide mb-2">Choices (visible to players)</p>
                <ul className="space-y-2">
                  {question.options.map((opt, i) => (
                    <li
                      key={i}
                      className="rounded-lg border border-slate-600 bg-slate-700/40 px-4 py-3 text-slate-200 text-sm"
                    >
                      <span className="text-slate-500 font-mono mr-2">{String.fromCharCode(65 + i)}.</span>
                      {opt || "(empty)"}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-slate-500 text-sm mt-4 shrink-0">Players are answering...</p>
          </div>
        )}

        {view === "finished" && results && (
          <div className={cardClass}>
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
            <button
              type="button"
              onClick={() => navigate("/quiz")}
              className="mt-4 w-full rounded-lg border border-slate-500 py-2.5 text-slate-200 font-medium hover:bg-slate-700 transition-colors"
            >
              Back to Quiz
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
