import { useMemo, useState } from "react";
import { Download, Search, ChevronDown, ChevronRight } from "lucide-react";
import { useAppSelector } from "../app/hooks";
import { useListReportQuizzesQuery, useGetQuizReportQuery, useLazyDownloadQuizCsvQuery } from "../services/reportsApi";

function formatDateTime(value?: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function formatDate(value?: string) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString();
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

const SVG_VIEW_WIDTH = 520;
const SVG_VIEW_HEIGHT = 160;

function SvgLineChart(props: {
  title: string;
  points: { x: string; y: number }[];
  height?: number;
}) {
  const { title, points, height = SVG_VIEW_HEIGHT } = props;
  const width = SVG_VIEW_WIDTH;
  const pad = 28;
  const w = width - pad * 2;
  const h = height - pad * 2;
  const ys = points.map((p) => p.y);
  const maxY = Math.max(1, ...ys);
  const minY = 0;
  const coords = points.map((p, i) => {
    const x = points.length <= 1 ? pad : pad + (i / (points.length - 1)) * w;
    const y = pad + (1 - (p.y - minY) / (maxY - minY || 1)) * h;
    return { x, y, label: p.x, value: p.y };
  });
  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ");

  return (
    <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-4 w-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <span className="text-xs text-slate-400">Last 7 days</span>
      </div>
      <div className="w-full overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto min-h-[140px]" preserveAspectRatio="xMidYMid meet">
          <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="rgba(148,163,184,0.35)" />
          <line x1={pad} y1={pad} x2={pad} y2={height - pad} stroke="rgba(148,163,184,0.35)" />
          <path d={path} fill="none" stroke="#60a5fa" strokeWidth="2.5" />
          {coords.map((c, i) => (
            <g key={i}>
              <circle cx={c.x} cy={c.y} r="3.5" fill="#60a5fa" />
              {i === 0 || i === coords.length - 1 || i === Math.floor(coords.length / 2) ? (
                <text x={c.x} y={height - 8} textAnchor="middle" fontSize="10" fill="rgba(226,232,240,0.75)">
                  {c.label}
                </text>
              ) : null}
            </g>
          ))}
          <text x={pad} y={pad - 8} fontSize="10" fill="rgba(226,232,240,0.65)">{maxY}</text>
          <text x={pad} y={height - pad + 14} fontSize="10" fill="rgba(226,232,240,0.65)">{minY}</text>
        </svg>
      </div>
    </div>
  );
}

function SvgBarChart(props: { title: string; points: { x: string; y: number }[] }) {
  const { title, points } = props;
  const width = SVG_VIEW_WIDTH;
  const height = SVG_VIEW_HEIGHT;
  const pad = 28;
  const w = width - pad * 2;
  const h = height - pad * 2;
  const maxY = Math.max(1, ...points.map((p) => p.y));
  const barW = points.length > 0 ? w / points.length : w;
  return (
    <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-4 w-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <span className="text-xs text-slate-400">Last 7 plays</span>
      </div>
      <div className="w-full overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto min-h-[140px]" preserveAspectRatio="xMidYMid meet">
          <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="rgba(148,163,184,0.35)" />
          {points.map((p, i) => {
            const x = pad + i * barW + barW * 0.15;
            const bw = barW * 0.7;
            const bh = (p.y / (maxY || 1)) * h;
            const y = pad + (h - bh);
            return (
              <g key={i}>
                <rect x={x} y={y} width={bw} height={bh} rx={6} fill="rgba(52,211,153,0.7)" />
                {i === 0 || i === points.length - 1 ? (
                  <text x={x + bw / 2} y={height - 8} textAnchor="middle" fontSize="10" fill="rgba(226,232,240,0.75)">
                    {p.x}
                  </text>
                ) : null}
              </g>
            );
          })}
          <text x={pad} y={pad - 8} fontSize="10" fill="rgba(226,232,240,0.65)">{maxY.toFixed(0)}</text>
        </svg>
      </div>
    </div>
  );
}

function csvEscape(val: string | number): string {
  const s = String(val ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadPlayCsv(
  play: { finishedAt: string; gameCode: string; sendReportEnabled: boolean; participants: { name: string; email?: string; score: number; total: number }[] },
  quizName: string
) {
  const includeEmail = play.sendReportEnabled;
  const header = includeEmail
    ? ["playFinishedAt", "gameCode", "playerName", "playerEmail", "score", "total"]
    : ["playFinishedAt", "gameCode", "playerName", "score", "total"];
  const when = play.finishedAt ? new Date(play.finishedAt).toISOString() : "";
  const rows = [header.join(",")];
  (play.participants || []).forEach((pp) => {
    const cols = includeEmail
      ? [when, play.gameCode, pp.name || "", (pp.email || "").toLowerCase(), String(pp.score ?? 0), String(pp.total ?? 0)]
      : [when, play.gameCode, pp.name || "", String(pp.score ?? 0), String(pp.total ?? 0)];
    rows.push(cols.map(csvEscape).join(","));
  });
  if ((play.participants || []).length === 0) {
    const cols = includeEmail ? [when, play.gameCode, "", "", "0", "0"] : [when, play.gameCode, "", "0", "0"];
    rows.push(cols.map(csvEscape).join(","));
  }
  const csv = rows.join("\n");
  const blob = new Blob([csv], { type: "text/csv; charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safeName = (quizName || "quiz").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  a.download = `${safeName}-play-${play.gameCode || "report"}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function Reports() {
  const membership = useAppSelector((state) => state.auth.membership);
  const { data: quizzes = [], isLoading: quizzesLoading } = useListReportQuizzesQuery(undefined, {
    refetchOnMountOrArgChange: true,
  });
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [expandedPlayIds, setExpandedPlayIds] = useState<Record<string, boolean>>({});
  const [downloadCsv, { isFetching: downloading }] = useLazyDownloadQuizCsvQuery();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return quizzes;
    return quizzes.filter((x) => x.name.toLowerCase().includes(q));
  }, [quizzes, query]);

  const selected = selectedQuizId ?? (filtered[0]?._id ?? null);
  const { data: report, isLoading: reportLoading } = useGetQuizReportQuery(selected!, {
    skip: !selected,
    refetchOnMountOrArgChange: true,
  });
  const [graphType, setGraphType] = useState<"participants" | "avgScore">("participants");

  const onDownload = async () => {
    if (!selected) return;
    const blob = await downloadCsv(selected).unwrap();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(report?.quiz?.name ?? "quiz").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-report.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Reports</h1>
          {membership?.teamName && (
            <p className="text-slate-400 text-sm mt-0.5">Team: {membership.teamName}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onDownload}
          disabled={!selected || downloading}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          {downloading ? "Downloading..." : "Download CSV"}
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        {/* Left: quizzes list */}
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 overflow-hidden">
          <div className="p-3 border-b border-slate-700/50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-900/30 px-9 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                placeholder="Search quizzes..."
              />
            </div>
          </div>
          <div className="max-h-[70vh] overflow-y-auto">
            {quizzesLoading ? (
              <div className="p-4 text-slate-400">Loading quizzes...</div>
            ) : filtered.length === 0 ? (
              <div className="p-4 text-slate-400">No quizzes found.</div>
            ) : (
              filtered.map((qz) => {
                const active = qz._id === selected;
                return (
                  <button
                    key={qz._id}
                    type="button"
                    onClick={() => setSelectedQuizId(qz._id)}
                    className={`w-full text-left px-4 py-3 border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors ${
                      active ? "bg-blue-600/20" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-white font-medium truncate">{qz.name}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Plays: <span className="text-slate-200">{qz.timesHosted}</span> · Participants:{" "}
                          <span className="text-slate-200">{qz.totalPlayersParticipated}</span>
                        </p>
                      </div>
                      <span className={`text-[10px] px-2 py-1 rounded-full border ${
                        qz.sendReportEnabled ? "border-emerald-500/40 text-emerald-300 bg-emerald-500/10" : "border-slate-500/40 text-slate-300 bg-slate-700/20"
                      }`}>
                        {qz.sendReportEnabled ? "Report ON" : "Report OFF"}
                      </span>
                    </div>
                    {qz.lastPlayedAt ? (
                      <p className="mt-1 text-[11px] text-slate-500">Last played: {formatDateTime(qz.lastPlayedAt)}</p>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right: drilldown */}
        <div className="min-w-0">
          {!selected ? (
            <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-6 text-slate-300">
              Select a quiz to view its report.
            </div>
          ) : reportLoading || !report ? (
            <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-6 text-slate-300">
              Loading report...
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-5 mb-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-xl font-semibold text-white truncate">{report.quiz.name}</h2>
                    <p className="text-sm text-slate-400 mt-1">
                      Created: {report.quiz.createdAt ? formatDate(report.quiz.createdAt) : "—"} · Report:{" "}
                      <span className={report.quiz.sendReportEnabled ? "text-emerald-300" : "text-slate-300"}>
                        {report.quiz.sendReportEnabled ? "Enabled" : "Disabled"}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3 mt-4">
                  <div className="rounded-lg border border-slate-700/50 bg-slate-900/20 p-4">
                    <p className="text-xs text-slate-400">Total plays</p>
                    <p className="text-2xl font-bold text-white mt-1">{report.quiz.timesHosted}</p>
                  </div>
                  <div className="rounded-lg border border-slate-700/50 bg-slate-900/20 p-4">
                    <p className="text-xs text-slate-400">Total participants</p>
                    <p className="text-2xl font-bold text-white mt-1">{report.quiz.totalPlayersParticipated}</p>
                  </div>
                  <div className="rounded-lg border border-slate-700/50 bg-slate-900/20 p-4">
                    <p className="text-xs text-slate-400">Last 7 days plays</p>
                    <p className="text-2xl font-bold text-white mt-1">
                      {report.last7Days.reduce((s, x) => s + (x.plays || 0), 0)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mb-4 w-full">
                <div className="flex gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setGraphType("participants")}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                      graphType === "participants"
                        ? "bg-blue-600 text-white"
                        : "bg-slate-700/50 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    Participants vs date
                  </button>
                  <button
                    type="button"
                    onClick={() => setGraphType("avgScore")}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                      graphType === "avgScore"
                        ? "bg-blue-600 text-white"
                        : "bg-slate-700/50 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    Last 7 plays — Avg score
                  </button>
                </div>
                <div className="w-full">
                  {graphType === "participants" ? (
                    <SvgLineChart
                      title="Participants vs date"
                      points={report.last7Days.map((d) => ({ x: d.date.slice(5), y: d.participants }))}
                    />
                  ) : (
                    <SvgBarChart
                      title="Last 7 plays — Avg score"
                      points={report.last7Plays.map((p, i) => ({
                        x: `#${i + 1}`,
                        y: clamp(p.avgScore, 0, 9999),
                      }))}
                    />
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-700/50">
                  <h3 className="text-sm font-semibold text-white">Plays</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Showing latest {report.plays.length} plays. Expand a play to see participants.
                  </p>
                </div>
                <div className="divide-y divide-slate-700/40">
                  {report.plays.length === 0 ? (
                    <div className="p-5 text-slate-400">No plays recorded yet.</div>
                  ) : (
                    report.plays.map((p) => {
                      const expanded = !!expandedPlayIds[p._id];
                      return (
                        <div key={p._id} className="px-5 py-4">
                          <div className="w-full flex items-center justify-between gap-3">
                            <button
                              type="button"
                              onClick={() => setExpandedPlayIds((prev) => ({ ...prev, [p._id]: !prev[p._id] }))}
                              className="flex-1 min-w-0 flex items-center justify-between gap-3 text-left"
                            >
                              <div className="min-w-0">
                                <p className="text-white font-medium">
                                  {formatDateTime(p.finishedAt)}{" "}
                                  <span className="text-xs text-slate-500 ml-2">Code: {p.gameCode}</span>
                                </p>
                                <p className="text-xs text-slate-400 mt-1">
                                  Participants: <span className="text-slate-200">{p.participantCount}</span> · Avg score:{" "}
                                  <span className="text-slate-200">{p.avgScore.toFixed(2)}</span>
                                </p>
                              </div>
                              {expanded ? <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" /> : <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                downloadPlayCsv(p, report.quiz.name);
                              }}
                              className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-slate-700/60 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-600/80 transition-colors"
                            >
                              <Download className="h-3.5 w-3.5" />
                              Download CSV
                            </button>
                          </div>
                          {expanded && (
                            <div className="mt-3 rounded-lg border border-slate-700/50 bg-slate-900/20 overflow-hidden">
                              <table className="w-full text-sm">
                                <thead className="bg-slate-800/60 text-slate-300">
                                  <tr>
                                    <th className="px-4 py-2 text-left font-medium">Name</th>
                                    {p.sendReportEnabled ? <th className="px-4 py-2 text-left font-medium">Email</th> : null}
                                    <th className="px-4 py-2 text-right font-medium">Score</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700/40">
                                  {p.participants.map((pp, idx) => (
                                    <tr key={idx} className="text-slate-200">
                                      <td className="px-4 py-2">{pp.name}</td>
                                      {p.sendReportEnabled ? <td className="px-4 py-2 text-slate-400">{pp.email || "—"}</td> : null}
                                      <td className="px-4 py-2 text-right">{pp.score} / {pp.total}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

