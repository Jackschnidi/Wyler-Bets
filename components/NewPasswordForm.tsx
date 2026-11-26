"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const input = {
  width: "100%",
  padding: "12px",
  borderRadius: "8px",
  border: "1px solid #334155",
  background: "#0f172a",
  color: "#f8fafc",
  fontSize: "16px",
};

export default function NewPasswordForm({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Das Passwort muss mindestens 8 Zeichen lang sein.");
      return;
    }
    if (password !== repeat) {
      setError("Die Passwörter stimmen nicht überein.");
      return;
    }

    setBusy(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);

    if (err) {
      setError(err.message);
      return;
    }
    onDone();
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div style={{ width: "100%", maxWidth: "380px" }}>
        <h1 style={{ margin: "0 0 8px", fontSize: "32px" }}>Neues Passwort</h1>
        <p style={{ margin: "0 0 20px", color: "#94a3b8" }}>Wähle ein neues Passwort für dein Konto.</p>
        <form onSubmit={onSubmit} style={{ display: "grid", gap: "10px" }}>
          <input
            style={input}
            type="password"
            required
            placeholder="Neues Passwort (mind. 8 Zeichen)"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <input
            style={input}
            type="password"
            required
            placeholder="Passwort wiederholen"
            autoComplete="new-password"
            value={repeat}
            onChange={(e) => setRepeat(e.target.value)}
          />
          <button
            type="submit"
            disabled={busy}
            style={{
              padding: "12px",
              borderRadius: "8px",
              border: "none",
              background: "#4ade80",
              color: "#0f172a",
              fontWeight: 700,
              fontSize: "16px",
              cursor: busy ? "wait" : "pointer",
              opacity: busy ? 0.7 : 1,
            }}
          >
            Passwort speichern
          </button>
        </form>
        {error && <p style={{ color: "#f87171", margin: "12px 0 0" }}>{error}</p>}
      </div>
    </main>
  );
}
