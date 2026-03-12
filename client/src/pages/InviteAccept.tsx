import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Lock, CheckCircle, Eye, EyeOff } from "lucide-react";
import logo from "../assets/logo.png";
import { useValidateInviteQuery, useAcceptInviteMutation } from "../services/inviteApi";

const inputClass =
  "mt-1 block w-full rounded border border-slate-500 bg-slate-700/50 px-3 py-2 pl-10 text-white placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none [&:-webkit-autofill]:!bg-slate-700/80";

export default function InviteAccept() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const { data: validateData, isLoading: validating, error: validateError } = useValidateInviteQuery(token, {
    skip: !token,
  });
  const [acceptInvite, { isLoading: accepting, isSuccess: acceptSuccess, error: acceptError }] = useAcceptInviteMutation();

  const valid = validateData?.valid === true;
  const errMsg =
    (validateError && "data" in validateError && typeof (validateError.data as { message?: string }).message === "string"
      ? (validateError.data as { message: string }).message
      : null) ||
    (acceptError && "data" in acceptError && typeof (acceptError.data as { message?: string }).message === "string"
      ? (acceptError.data as { message: string }).message
      : null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !password || password !== confirmPassword || password.length < 6) return;
    try {
      await acceptInvite({ token, password, confirmPassword }).unwrap();
    } catch {
      // Error handled via acceptError
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-black/40 to-slate-950 px-4">
        <div className="w-full max-w-md text-center">
          <img src={logo} alt="Brain Box" className="h-14 w-auto object-contain mx-auto mb-4" />
          <p className="text-slate-300 mb-4">Invalid invite link. Please use the link from your invite email.</p>
          <Link to="/login" className="text-blue-400 hover:underline">Go to login</Link>
        </div>
      </div>
    );
  }

  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-black/40 to-slate-950 px-4">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  if (!valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-black/40 to-slate-950 px-4">
        <div className="w-full max-w-md text-center">
          <img src={logo} alt="Brain Box" className="h-14 w-auto object-contain mx-auto mb-4" />
          <p className="text-red-400 mb-2">{errMsg || "Invalid or expired invite link."}</p>
          <p className="text-slate-400 text-sm mb-4">Please request a new invite from your admin.</p>
          <Link to="/login" className="text-blue-400 hover:underline">Go to login</Link>
        </div>
      </div>
    );
  }

  if (acceptSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-black/40 to-slate-950 px-4">
        <div className="w-full max-w-md text-center">
          <img src={logo} alt="Brain Box" className="h-14 w-auto object-contain mx-auto mb-4" />
          <CheckCircle className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">You're all set</h1>
          <p className="text-slate-300 mb-6">Password set. You can now log in to the application.</p>
          <Link
            to="/login"
            className="inline-block rounded bg-blue-600 px-6 py-2.5 text-white font-medium hover:bg-blue-500"
          >
            Log in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-black/40 to-slate-950 px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <img src={logo} alt="Brain Box" className="h-14 w-auto object-contain" />
        </div>
        <h1 className="text-2xl font-bold text-center text-white">Set your password</h1>
        <p className="text-slate-400 text-sm text-center">
          You've been invited to join <strong className="text-slate-300">{validateData.teamName}</strong>. Set a password to complete sign-up.
        </p>
        <form
          onSubmit={handleSubmit}
          className="space-y-4 bg-slate-800/60 backdrop-blur border border-slate-700/50 p-6 rounded-lg shadow-xl text-white"
        >
          <div className="rounded bg-slate-700/40 px-3 py-2 text-sm text-slate-300">
            <span className="text-slate-400">Email: </span>{validateData.email}
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-white">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                placeholder="At least 6 characters"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white rounded p-0.5"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-white">Confirm password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
              <input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={inputClass}
                placeholder="Confirm password"
                required
                minLength={6}
              />
            </div>
          </div>
          {password && confirmPassword && password !== confirmPassword && (
            <p className="text-amber-400 text-sm">Passwords do not match.</p>
          )}
          {errMsg && <p className="text-red-400 text-sm">{errMsg}</p>}
          <button
            type="submit"
            disabled={accepting || password.length < 6 || password !== confirmPassword}
            className="w-full rounded bg-blue-600 py-2 text-white font-medium hover:bg-blue-500 disabled:opacity-50 transition-colors"
          >
            {accepting ? "Setting password..." : "Set password & join"}
          </button>
        </form>
      </div>
    </div>
  );
}
