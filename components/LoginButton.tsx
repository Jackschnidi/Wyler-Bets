"use client";

import { createClient } from "@/lib/supabase/client";

export default function LoginButton() {
  async function login() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "azure", // Microsoft
      options: {
        scopes: "email", // Supabase verlangt eine gültige E-Mail von Microsoft
        // zurück auf die aktuelle Seite (GitHub Pages: /Wyler-Bets/)
        redirectTo: `${window.location.origin}${window.location.pathname}`,
      },
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
      Mit Microsoft anmelden
    </button>
  );
}
