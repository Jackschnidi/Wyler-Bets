"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ghostButton, input, primaryButton } from "@/components/ui";

type Comment = { id: number; user_id: string; body: string; created_at: string };

export default function Comments({
  predictionId,
  userId,
  isAdmin,
  names,
}: {
  predictionId: string;
  userId: string;
  isAdmin: boolean;
  names: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const supabase = createClient();
    const { data, error: err } = await supabase
      .from("prediction_comments")
      .select("id, user_id, body, created_at")
      .eq("prediction_id", predictionId)
      .order("created_at", { ascending: true });
    if (err) setError(err.message);
    setItems((data ?? []) as Comment[]);
  }

  async function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    setError("");
    await load();
  }

  async function onPost(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!text.trim()) return;
    setError("");
    const supabase = createClient();
    const { error: err } = await supabase.rpc("add_comment", { p_prediction: predictionId, p_body: text });
    if (err) {
      setError(err.message);
      return;
    }
    setText("");
    await load();
  }

  async function onDelete(id: number) {
    if (!confirm("Kommentar löschen?")) return;
    const supabase = createClient();
    const { error: err } = await supabase.rpc("delete_comment", { p_id: id });
    if (err) setError(err.message);
    await load();
  }

  return (
    <div style={{ marginTop: "12px" }}>
      <button type="button" onClick={toggle} style={ghostButton}>
        {open ? "Kommentare ausblenden" : "Kommentare anzeigen"}
      </button>
      {open && (
        <div style={{ marginTop: "10px" }}>
          {items.length === 0 && !error && (
            <p style={{ color: "#94a3b8", margin: "0 0 10px" }}>Noch keine Kommentare.</p>
          )}
          <ul style={{ listStyle: "none", margin: "0 0 10px", padding: 0, display: "grid", gap: "8px" }}>
            {items.map((c) => (
              <li key={c.id} style={{ background: "#0f172a", borderRadius: "8px", padding: "10px 12px" }}>
                <div style={{ display: "flex", gap: "8px", alignItems: "baseline" }}>
                  <strong style={{ fontSize: "14px" }}>{names[c.user_id] ?? "Spieler"}</strong>
                  <span style={{ color: "#64748b", fontSize: "12px" }}>
                    {new Date(c.created_at).toLocaleString("de-CH")}
                  </span>
                  {(c.user_id === userId || isAdmin) && (
                    <button
                      type="button"
                      onClick={() => onDelete(c.id)}
                      style={{
                        marginLeft: "auto",
                        background: "none",
                        border: "none",
                        color: "#f87171",
                        cursor: "pointer",
                        fontSize: "12px",
                      }}
                    >
                      löschen
                    </button>
                  )}
                </div>
                <p style={{ margin: "4px 0 0", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{c.body}</p>
              </li>
            ))}
          </ul>
          <form onSubmit={onPost} style={{ display: "flex", gap: "10px" }}>
            <input
              style={input}
              placeholder="Kommentar schreiben …"
              maxLength={500}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <button type="submit" style={primaryButton}>
              Senden
            </button>
          </form>
          {error && <p style={{ color: "#f87171", margin: "8px 0 0" }}>{error}</p>}
        </div>
      )}
    </div>
  );
}
