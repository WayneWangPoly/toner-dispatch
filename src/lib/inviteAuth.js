import { supabase } from "./supabaseClient";

function requireSupabase() {
  if (!supabase) throw new Error("Supabase is not connected.");
  return supabase;
}

export function normalizeEmail(email = "") {
  return email.trim().toLowerCase();
}

export function normalizeInviteCode(code = "") {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

async function sha256Hex(value) {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashInviteCode(code) {
  const normalized = normalizeInviteCode(code);
  if (!normalized) return "";
  return sha256Hex(normalized);
}

export async function getApprovedProfile(userId) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("app_user_profiles")
    .select("id,email,staff_name,role,approved,disabled_at")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data || !data.approved || data.disabled_at) return null;
  return data;
}

export async function signInApproved({ email, password }) {
  const client = requireSupabase();
  const cleanEmail = normalizeEmail(email);

  const { data, error } = await client.auth.signInWithPassword({
    email: cleanEmail,
    password,
  });

  if (error) throw error;

  const profile = await getApprovedProfile(data.user.id);
  if (!profile) {
    await client.auth.signOut();
    throw new Error("This account is not approved for Toner Dispatch. Use a manager invite code to create an approved account, or ask the manager to re-enable your access.");
  }

  return { user: data.user, profile };
}

export async function checkInvite({ email, staffName, inviteCode }) {
  const client = requireSupabase();
  const inviteCodeHash = await hashInviteCode(inviteCode);

  if (!inviteCodeHash) {
    return { ok: false, message: "Please enter your invite code." };
  }

  const { data, error } = await client.rpc("check_login_invite", {
    p_email: normalizeEmail(email),
    p_staff_name: staffName,
    p_code_hash: inviteCodeHash,
  });

  if (error) throw error;
  const first = Array.isArray(data) ? data[0] : data;
  return first || { ok: false, message: "Invite code could not be checked." };
}

export async function signUpWithInvite({ email, password, staffName, inviteCode }) {
  const client = requireSupabase();
  const cleanEmail = normalizeEmail(email);
  const inviteCodeHash = await hashInviteCode(inviteCode);

  const check = await checkInvite({ email: cleanEmail, staffName, inviteCode });
  if (!check.ok) throw new Error(check.message || "Invite code is not valid.");

  const redirectUrl = `${window.location.origin}/`;
  const { data, error } = await client.auth.signUp({
    email: cleanEmail,
    password,
    options: {
      emailRedirectTo: redirectUrl,
      data: {
        app: "toner-dispatch",
        staff_name: staffName,
        invite_code_hash: inviteCodeHash,
      },
    },
  });

  if (error) throw error;

  // If email confirmation is OFF, Supabase returns a live session immediately.
  // If email confirmation is ON, the user will confirm by email and then sign in.
  if (data?.session && data?.user) {
    const profile = await getApprovedProfile(data.user.id);
    if (!profile) {
      await client.auth.signOut();
      throw new Error("Account was created but was not approved. Please check the invite email, staff name and code, or ask the manager to issue a new invite.");
    }
    return { user: data.user, profile, needsEmailConfirmation: false };
  }

  return { user: data?.user || null, profile: null, needsEmailConfirmation: true };
}

export async function requestPasswordReset(email) {
  const client = requireSupabase();
  const cleanEmail = normalizeEmail(email);

  const { error } = await client.auth.resetPasswordForEmail(cleanEmail, {
    redirectTo: `${window.location.origin}/?password-recovery=1`,
  });

  if (error) throw error;
}
