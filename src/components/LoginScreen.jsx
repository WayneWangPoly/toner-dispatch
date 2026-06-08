import { useState } from "react";
import { STAFF } from "../lib/staff";
import {
  checkInvite,
  requestPasswordReset,
  signInApproved,
  signUpWithInvite,
} from "../lib/inviteAuth";

export default function LoginScreen({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState(STAFF[0]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function switchMode(nextMode) {
    setMode(nextMode);
    setError("");
    setMessage("");
  }

  async function handleLogin(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const { user, profile } = await signInApproved({ email, password });
      onLogin(user, profile.staff_name || name);
    } catch (err) {
      setError(err?.message || "Login failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSignup(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      setBusy(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setBusy(false);
      return;
    }

    try {
      const check = await checkInvite({ email, staffName: name, inviteCode });
      if (!check.ok) throw new Error(check.message || "Invite code is not valid.");

      const result = await signUpWithInvite({ email, password, staffName: name, inviteCode });
      if (result.needsEmailConfirmation) {
        setMessage("Account created. Please open the confirmation email, then come back and log in with your new password.");
        setPassword("");
        setConfirmPassword("");
        setInviteCode("");
        setMode("login");
        return;
      }

      onLogin(result.user, result.profile.staff_name || name);
    } catch (err) {
      setError(err?.message || "Could not create account.");
    } finally {
      setBusy(false);
    }
  }

  async function handleForgotPassword(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    try {
      await requestPasswordReset(email);
      setMessage("Password reset email sent. Open the link in your email to set a new password.");
      setMode("login");
    } catch (err) {
      setError(err?.message || "Could not send reset email.");
    } finally {
      setBusy(false);
    }
  }

  const isSignup = mode === "signup";
  const isForgot = mode === "forgot";

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8">
      <form
        onSubmit={isForgot ? handleForgotPassword : isSignup ? handleSignup : handleLogin}
        className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl"
      >
        <p className="text-xs font-black uppercase tracking-[0.22em] text-red-600">BBC Digital</p>
        <h1 className="mt-2 text-2xl font-black text-slate-950">Toner Dispatch</h1>
        <p className="mt-2 text-sm text-slate-600">
          {isSignup
            ? "First login: use your manager invite code and set your own password."
            : isForgot
              ? "Enter your email and we will send a reset link."
              : "Sign in with your own approved company account."}
        </p>

        {isSignup && (
          <label className="mt-6 block text-xs font-bold uppercase tracking-wide text-slate-500">
            Staff name
            <select
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm font-bold text-slate-950 outline-none focus:border-red-500"
            >
              {STAFF.map((person) => (
                <option key={person} value={person}>{person}</option>
              ))}
            </select>
          </label>
        )}

        <label className={`${isSignup ? "mt-4" : "mt-6"} block text-xs font-bold uppercase tracking-wide text-slate-500`}>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            placeholder="name@company.com"
            className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm font-bold text-slate-950 outline-none placeholder:text-slate-400 focus:border-red-500"
          />
        </label>

        {!isForgot && (
          <label className="mt-4 block text-xs font-bold uppercase tracking-wide text-slate-500">
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={isSignup ? "new-password" : "current-password"}
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm font-bold text-slate-950 outline-none focus:border-red-500"
            />
          </label>
        )}

        {isSignup && (
          <>
            <label className="mt-4 block text-xs font-bold uppercase tracking-wide text-slate-500">
              Confirm password
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm font-bold text-slate-950 outline-none focus:border-red-500"
              />
            </label>

            <label className="mt-4 block text-xs font-bold uppercase tracking-wide text-slate-500">
              Manager invite code
              <input
                value={inviteCode}
                onChange={(event) => setInviteCode(event.target.value)}
                autoComplete="one-time-code"
                placeholder=""
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm font-bold text-slate-950 outline-none placeholder:text-slate-400 focus:border-red-500"
              />
            </label>
          </>
        )}

        {error && <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
        {message && <p className="mt-4 rounded-2xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{message}</p>}

        <button
          type="submit"
          disabled={busy}
          className="mt-6 w-full rounded-2xl bg-red-600 px-4 py-3 text-sm font-black text-white shadow-sm active:scale-95 disabled:opacity-60"
        >
          {busy ? "Please wait..." : isSignup ? "Create approved account" : isForgot ? "Send reset email" : "Login"}
        </button>

        <div className="mt-5 flex flex-col gap-2 text-center text-sm font-bold">
          {!isSignup && <button type="button" onClick={() => switchMode("signup")} className="text-red-700">First login with invite code</button>}
          {!isForgot && <button type="button" onClick={() => switchMode("forgot")} className="text-slate-600">Forgot password?</button>}
          {(isSignup || isForgot) && <button type="button" onClick={() => switchMode("login")} className="text-slate-600">Back to login</button>}
        </div>
      </form>
    </main>
  );
}

