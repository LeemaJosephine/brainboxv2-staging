import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { KeyRound, Loader2, LogOut } from "lucide-react";
import logo from "../assets/logo.png";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import { setMembership } from "../features/auth/authSlice";
import { logoutAndClearCache } from "../app/store";
import { useJoinTeamMutation } from "../services/teamApi";

export default function Onboarding() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { token, user, membership } = useAppSelector((state) => state.auth);
  const [joinTeam, { isLoading: joining, error: joinError }] = useJoinTeamMutation();
  const [teamCode, setTeamCode] = useState("");

  useEffect(() => {
    if (!token) navigate("/login", { replace: true });
    else if (user?.role === "admin") navigate("/quiz", { replace: true });
    else if (membership?.status === "active") navigate("/quiz", { replace: true });
  }, [token, user?.role, membership?.status, navigate]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamCode.trim()) return;
    try {
      const res = await joinTeam({ teamCode: teamCode.trim().toUpperCase() }).unwrap();
      dispatch(setMembership(res.membership));
      if (res.membership.status === "active") {
        navigate("/quiz");
      }
    } catch {
      // error from mutation
    }
  };

  const joinErr =
    joinError && "data" in joinError &&
    typeof (joinError.data as { message?: string }).message === "string"
      ? (joinError.data as { message: string }).message
      : null;

  const inputClass =
    "mt-1 block w-full rounded border border-slate-500 bg-slate-700/50 px-3 py-2 pl-10 text-white placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none";

  if (membership?.status === "pending") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-black/40 to-slate-950 px-4 py-8">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="flex justify-center mb-4">
            <img src={logo} alt="Brain Box" className="h-14 w-auto object-contain" />
          </div>
          <div className="bg-slate-800/60 backdrop-blur border border-slate-700/50 p-8 rounded-lg shadow-xl">
            <Loader2 className="h-12 w-12 text-blue-400 animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">
              Waiting for approval
            </h2>
            <p className="text-slate-300 text-sm">
              Your request to join the team has been sent. The team manager will
              approve you soon. You can log in again later to access the app.
            </p>
            <div className="mt-6 flex flex-col gap-3 items-center">
              <Link to="/login" className="text-blue-400 hover:underline text-sm">
                Back to login
              </Link>
              <button
                type="button"
                onClick={() => {
                  dispatch(logoutAndClearCache());
                  navigate("/login", { replace: true });
                }}
                className="flex items-center gap-2 rounded border border-slate-500 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700/50 hover:text-white transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-black/40 to-slate-950 px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <img src={logo} alt="Brain Box" className="h-14 w-auto object-contain" />
        </div>
        <h1 className="text-2xl font-bold text-center text-white">
          Join your team
        </h1>
        <p className="text-center text-slate-300 text-sm">
          Enter the 9-character Team ID provided by your team manager.
        </p>
        <form
          onSubmit={handleJoin}
          className="space-y-4 bg-slate-800/60 backdrop-blur border border-slate-700/50 p-6 rounded-lg shadow-xl text-white"
        >
          <div>
            <label htmlFor="teamCode" className="block text-sm font-medium text-white">
              Team ID
            </label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
              <input
                id="teamCode"
                name="teamCode"
                type="text"
                required
                maxLength={9}
                value={teamCode}
                onChange={(e) => setTeamCode(e.target.value.toUpperCase())}
                className={`${inputClass} pl-10`}
                placeholder="9-character code"
              />
            </div>
          </div>
          <p className="text-xs text-slate-400">
            You will need approval from the team manager to join. After approval you can
            access quizzes and reports.
          </p>
          {joinErr && <p className="text-sm text-red-400">{joinErr}</p>}
          <button
            type="submit"
            disabled={joining}
            className="w-full rounded bg-blue-600 py-2.5 text-white font-medium hover:bg-blue-500 disabled:opacity-50 transition-colors"
          >
            {joining ? "Joining..." : "Join team"}
          </button>
        </form>
        <p className="text-center text-sm text-slate-400">
          <Link to="/login" className="text-blue-400 hover:underline">
            Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}
