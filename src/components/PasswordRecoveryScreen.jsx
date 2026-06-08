import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function PasswordRecoveryScreen({ onDone }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!supabase) {
      setError("Supabase is not connected.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      await onDone?.();
    } catch (err) {
      setError(err?.message || "Could not update password.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-red-600">Toner Dispatch</p>
        <h1 className="mt-2 text-2xl font-black text-slate-950">Set new password</h1>
        <p className="mt-2 text-sm text-slate-600">
          Enter a new password for your own account. The manager never needs to know it.
        </p>

        <label className="mt-6 block text-xs font-bold uppercase tracking-wide text-slate-500">
          New password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm font-bold text-slate-950 outline-none focus:border-red-500"
          />
        </label>

        <label className="mt-4 block text-xs font-bold uppercase tracking-wide text-slate-500">
          Confirm new password
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm font-bold text-slate-950 outline-none focus:border-red-500"
          />
        </label>

        {error && <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="mt-6 w-full rounded-2xl bg-red-600 px-4 py-3 text-sm font-black text-white shadow-sm active:scale-95 disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save password"}
        </button>
      </form>
    </main>
  );
}
