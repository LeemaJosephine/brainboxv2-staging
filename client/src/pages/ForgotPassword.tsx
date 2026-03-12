import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Lock } from "lucide-react";
import logo from "../assets/logo.png";
import { useForgotPasswordMutation, useResetPasswordMutation } from "../services/authApi";

type Step = "request" | "reset";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [requestReset, { isLoading: requesting }] = useForgotPasswordMutation();
  const [resetPassword, { isLoading: resetting }] = useResetPasswordMutation();

  const inputClass =
    "mt-1 block w-full rounded border border-slate-500 bg-slate-700/50 px-3 py-2 text-white placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none";

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setError(null);
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Please enter your email.");
      return;
    }
    try {
      const res = await requestReset({ email: trimmedEmail }).unwrap();
      setMessage(res.message || "If an account exists for this email, an OTP has been sent.");
      setStep("reset");
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "data" in err && typeof (err as { data?: { message?: string } }).data?.message === "string"
          ? (err as { data: { message: string } }).data.message
          : "Failed to send OTP. Please try again.";
      setError(msg);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setError(null);
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Email is required.");
      return;
    }
    if (!otp.trim()) {
      setError("Please enter the OTP you received.");
      return;
    }
    if (!password || password.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("New password and confirm password do not match.");
      return;
    }
    try {
      const res = await resetPassword({ email: trimmedEmail, otp: otp.trim(), password }).unwrap();
      setMessage(res.message || "Password updated successfully. You can now log in.");
      setTimeout(() => navigate("/login"), 1200);
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "data" in err && typeof (err as { data?: { message?: string } }).data?.message === "string"
          ? (err as { data: { message: string } }).data.message
          : "Failed to reset password. Please try again.";
      setError(msg);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900/40 to-slate-900 px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <img src={logo} alt="Brain Box" className="h-14 w-auto object-contain" />
        </div>
        <h1 className="text-2xl font-bold text-center text-white">
          {step === "request" ? "Forgot password" : "Reset password"}
        </h1>
        {step === "request" ? (
          <form
            onSubmit={handleRequest}
            className="space-y-4 bg-slate-800/60 backdrop-blur border border-slate-700/50 p-6 rounded-lg shadow-xl text-white"
          >
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-white">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`${inputClass} pl-10`}
                  placeholder="you@example.com"
                />
              </div>
            </div>
            {message && <p className="text-sm text-emerald-400">{message}</p>}
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={requesting}
              className="w-full rounded bg-blue-600 py-2 text-white font-medium hover:bg-blue-500 disabled:opacity-50 transition-colors"
            >
              {requesting ? "Sending OTP..." : "Send OTP"}
            </button>
          </form>
        ) : (
          <form
            onSubmit={handleReset}
            className="space-y-4 bg-slate-800/60 backdrop-blur border border-slate-700/50 p-6 rounded-lg shadow-xl text-white"
          >
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-white">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`${inputClass} pl-10`}
                  placeholder="you@example.com"
                />
              </div>
            </div>
            <div>
              <label htmlFor="otp" className="block text-sm font-medium text-white">
                OTP
              </label>
              <input
                id="otp"
                name="otp"
                type="text"
                inputMode="numeric"
                maxLength={6}
                required
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                className={inputClass}
                placeholder="6-digit code"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-white">
                New password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${inputClass} pl-10`}
                  placeholder="At least 6 characters"
                />
              </div>
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-white">
                Confirm new password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={inputClass}
                placeholder="Re-enter new password"
              />
            </div>
            {message && <p className="text-sm text-emerald-400">{message}</p>}
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={resetting}
              className="w-full rounded bg-blue-600 py-2 text-white font-medium hover:bg-blue-500 disabled:opacity-50 transition-colors"
            >
              {resetting ? "Saving..." : "Save new password"}
            </button>
          </form>
        )}
        <p className="text-center text-sm text-slate-200">
          Remembered your password?{" "}
          <Link to="/login" className="text-blue-300 hover:underline">
            Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}

