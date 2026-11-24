"use client";

import { createClient } from "@/lib/supabase/client";

export default function LoginButton() {
  async function login() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <button
      onClick={login}
      style={{
        padding: "14px 28px",
        borderRadius: "10px",
        border: "none",
        background: "#f8fafc",
        color: "#0f172a",
        fontWeight: 700,
        fontSize: "16px",
        cursor: "pointer",
      }}
    >
      Mit Google anmelden
    </button>
  );
}
