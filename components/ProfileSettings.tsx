"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { card, input, primaryButton } from "@/components/ui";

export default function ProfileSettings({
  email,
  currentName,
  onSaved,
}: {
  email: string;
  currentName: string;
  onSaved: () => void;
}) {
  const [name, setName] = useState(currentName);
  const [nameMsg, setNameMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function saveName(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setNameMsg(null);
    const supabase = createClient();
    const { error } = await supabase.rpc("update_username", { p_name: name });
    if (error) {
      setNameMsg({ ok: false, text: error.message });
      return;
    }
    setNameMsg({ ok: true, text: "Benutzername gespeichert" });
    onSaved();
  }

  async function savePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPwMsg(null);
    if (password.length < 8) {
      setPwMsg({ ok: false, text: "Das Passwort muss mindestens 8 Zeichen lang sein." });
      return;
    }
    if (password !== repeat) {
      setPwMsg({ ok: false, text: "Die Passwörter stimmen nicht überein." });
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setPwMsg({ ok: false, text: error.message });
      return;
    }
    setPassword("");
    setRepeat("");
    setPwMsg({ ok: true, text: "Passwort geändert" });
  }

  return (
    <div style={{ display: "grid", gap: "16px" }}>
      <section style={card}>
        <h2 style={{ margin: "0 0 4px", fontSize: "20px" }}>Benutzername</h2>
        <p style={{ margin: "0 0 12px", color: "#94a3b8", fontSize: "14px" }}>Angemeldet mit {email}</p>
        <form onSubmit={saveName} style={{ display: "flex", gap: "10px" }}>
          <input
            style={input}
            value={name}
            minLength={2}
            maxLength={30}
            onChange={(e) => setName(e.target.value)}
          />
          <button type="submit" style={primaryButton}>
            Speichern
          </button>
        </form>
        {nameMsg && (
          <p style={{ margin: "8px 0 0", color: nameMsg.ok ? "#4ade80" : "#f87171" }}>{nameMsg.text}</p>
        )}
      </section>

      <section style={card}>
        <h2 style={{ margin: "0 0 12px", fontSize: "20px" }}>Passwort ändern</h2>
        <form onSubmit={savePassword} style={{ display: "grid", gap: "10px" }}>
          <input
            style={input}
            type="password"
            placeholder="Neues Passwort (mind. 8 Zeichen)"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <input
            style={input}
            type="password"
            placeholder="Passwort wiederholen"
            autoComplete="new-password"
            value={repeat}
            onChange={(e) => setRepeat(e.target.value)}
          />
          <button type="submit" style={{ ...primaryButton, justifySelf: "start" }}>
            Passwort speichern
          </button>
        </form>
        {pwMsg && <p style={{ margin: "8px 0 0", color: pwMsg.ok ? "#4ade80" : "#f87171" }}>{pwMsg.text}</p>}
      </section>
    </div>
  );
}
