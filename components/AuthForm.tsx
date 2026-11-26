"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import LoginButton from "@/components/LoginButton";

const input = {
  width: "100%",
  padding: "12px",
  borderRadius: "8px",
  border: "1px solid #334155",
  background: "#0f172a",
  color: "#f8fafc",
  fontSize: "16px",
};

function translate(message: string) {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "E-Mail oder Passwort ist falsch.";
  if (m.includes("email not confirmed")) return "Bitte bestätige zuerst deine E-Mail (Link im Postfach).";
  if (m.includes("password should be at least")) return "Das Passwort ist zu kurz.";
  if (m.includes("rate limit")) return "Zu viele Versuche. Bitte warte einen Moment.";
  return message;
}

export default function AuthForm() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setInfo("");

    if (password.length < 8) {
      setError("Das Passwort muss mindestens 8 Zeichen lang sein.");
      return;
    }

    setBusy(true);
    const supabase = createClient();

    if (mode === "login") {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) setError(translate(err.message));
      // Bei Erfolg meldet onAuthStateChange auf der Startseite den Login automatisch.
    } else {
      const { data, error: err } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: username.trim() || email.split("@")[0] },
          emailRedirectTo: `${window.location.origin}${window.location.pathname}`,
        },
      });
      if (err) {
        setError(translate(err.message));
      } else if (data.user && data.user.identities && data.user.identities.length === 0) {
        setError("Diese E-Mail ist schon registriert. Bitte melde dich an.");
      } else if (!data.session) {
        setInfo("Fast geschafft: Wir haben dir eine E-Mail geschickt. Klick auf den Link darin, dann kannst du dich anmelden.");
      }
    }

    setBusy(false);
  }

  return (
    <div style={{ width: "100%", maxWidth: "380px", margin: "0 auto", textAlign: "left" }}>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: "10px" }}>
        {mode === "register" && (
          <input
            style={input}
            placeholder="Benutzername (optional)"
            autoComplete="nickname"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        )}
        <input
          style={input}
          type="email"
          required
          placeholder="E-Mail"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          style={input}
          type="password"
          required
          placeholder="Passwort (mind. 8 Zeichen)"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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
          {mode === "login" ? "Anmelden" : "Registrieren"}
        </button>
      </form>

      {error && <p style={{ color: "#f87171", margin: "12px 0 0" }}>{error}</p>}
      {info && <p style={{ color: "#4ade80", margin: "12px 0 0" }}>{info}</p>}

      <p style={{ margin: "14px 0 0", textAlign: "center", color: "#94a3b8", fontSize: "14px" }}>
        {mode === "login" ? "Noch kein Konto? " : "Schon ein Konto? "}
        <button
          type="button"
          onClick={() => {
            setMode(mode === "login" ? "register" : "login");
            setError("");
            setInfo("");
          }}
          style={{
            background: "none",
            border: "none",
            color: "#f8fafc",
            textDecoration: "underline",
            cursor: "pointer",
            fontSize: "14px",
            padding: 0,
          }}
        >
          {mode === "login" ? "Registrieren" : "Anmelden"}
        </button>
      </p>

      <p style={{ margin: "20px 0", textAlign: "center", color: "#64748b", fontSize: "14px" }}>oder</p>
      <div style={{ textAlign: "center" }}>
        <LoginButton />
      </div>
    </div>
  );
}
