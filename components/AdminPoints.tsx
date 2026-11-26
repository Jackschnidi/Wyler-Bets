"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Player } from "@/components/types";
import { card, input, primaryButton } from "@/components/ui";

export default function AdminPoints({ players, onDone }: { players: Player[]; onDone: () => void }) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const target = String(form.get("player") ?? "");
    const delta = Number(form.get("delta"));
    const note = String(form.get("note") ?? "").trim();

    if (!target || !Number.isInteger(delta) || delta === 0) {
      setMsg({ ok: false, text: "Bitte Spieler und eine ganze Zahl (ungleich 0) angeben" });
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.rpc("admin_add_points", { target, delta, note: note || null });
    if (error) {
      setMsg({ ok: false, text: error.message });
      return;
    }
    setMsg({ ok: true, text: "Punkte gebucht" });
    formEl.reset();
    onDone();
  }

  return (
    <section style={card}>
      <h2 style={{ margin: "0 0 12px", fontSize: "20px" }}>Admin: Punkte vergeben</h2>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: "10px" }}>
        <select name="player" defaultValue="" style={input}>
          <option value="" disabled>
            Spieler wählen
          </option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label} ({p.balance} Punkte)
            </option>
          ))}
        </select>
        <input name="delta" type="number" step={1} placeholder="Punkte (negativ zum Abziehen)" style={input} />
        <input name="note" placeholder="Notiz (optional)" style={input} />
        <button type="submit" style={{ ...primaryButton, justifySelf: "start" }}>
          Buchen
        </button>
      </form>
      {msg && <p style={{ margin: "8px 0 0", color: msg.ok ? "#4ade80" : "#f87171" }}>{msg.text}</p>}
    </section>
  );
}
