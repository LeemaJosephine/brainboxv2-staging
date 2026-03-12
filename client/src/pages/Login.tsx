import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff, AlertCircle } from "lucide-react";
import logo from "../assets/logo.png";
import { useLoginMutation, authApi } from "../services/authApi";
import { useAppDispatch } from "../app/hooks";
import { setCredentials } from "../features/auth/authSlice";

const INACTIVE_MESSAGE = "Your account is inactive. Please contact your admin to activate your account.";

export default function Login() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [login, { isLoading, error }] = useLoginMutation();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showInactiveDialog, setShowInactiveDialog] = useState(false);

  const isInactiveError =
    error &&
    "status" in error &&
    (error as { status?: number }).status === 403 &&
    "data" in error &&
    ((error.data as { code?: string }).code === "ACCOUNT_INACTIVE" ||
      String((error.data as { message?: string }).message ?? "").toLowerCase().includes("inactive"));

  useEffect(() => {
    if (isInactiveError) setShowInactiveDialog(true);
  }, [isInactiveError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowInactiveDialog(false);
    try {
      const res = await login({ email, password }).unwrap();
      dispatch(setCredentials({ token: res.token, user: res.user, membership: res.membership }));
      dispatch(authApi.util.resetApiState());
      if (res.user?.role === "admin") {
        navigate("/quiz");
      } else if (res.membership?.status === "active") {
        navigate("/quiz");
      } else {
        navigate("/onboarding");
      }
    } catch {
      // Error shown via RTK Query and/or inactive dialog
    }
  };

  const errMsg =
    !showInactiveDialog &&
    error &&
    "data" in error &&
    typeof (error.data as { message?: string }).message === "string"
      ? (error.data as { message: string }).message
      : null;

  const inputClass =
    "mt-1 block w-full rounded border border-slate-500 bg-slate-700/50 px-3 py-2 pl-10 text-white placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none [&:-webkit-autofill]:!bg-slate-700/80";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-black/40 to-slate-950 px-4">
      {showInactiveDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-slate-600 bg-slate-800 p-6 shadow-xl text-center">
            <AlertCircle className="h-12 w-12 text-amber-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Account inactive</h3>
            <p className="text-slate-300 text-sm mb-6">{INACTIVE_MESSAGE}</p>
            <button
              type="button"
              onClick={() => setShowInactiveDialog(false)}
              className="w-full rounded bg-slate-600 py-2 text-white font-medium hover:bg-slate-500"
            >
              OK
            </button>
          </div>
        </div>
      )}
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <img src={logo} alt="Brain Box" className="h-14 w-auto object-contain" />
        </div>
        <h1 className="text-2xl font-bold text-center text-white">Log in</h1>
        <form onSubmit={handleSubmit} className="space-y-4 bg-slate-800/60 backdrop-blur border border-slate-700/50 p-6 rounded-lg shadow-xl text-white">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-white">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
              <input
                id="email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                placeholder="you@example.com"
              />
            </div>
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-white">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                placeholder="Your password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 rounded p-0.5"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>
          {errMsg && <p className="text-sm text-red-400">{errMsg}</p>}
          <div className="flex justify-end">
            <Link to="/forgot-password" className="text-xs text-blue-300 hover:underline">
              Forgot password?
            </Link>
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded bg-blue-600 py-2 text-white font-medium hover:bg-blue-500 disabled:opacity-50 transition-colors"
          >
            {isLoading ? "Logging in..." : "Log in"}
          </button>
        </form>
      </div>
    </div>
  );
}
