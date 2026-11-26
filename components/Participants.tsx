"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ghostButton } from "@/components/ui";

type Row = { user_id: string; option_id: string | null; stake: number };

export default function Participants({
  predictionId,
  names,
  options,
  canRemove = false,
  onRemoved,
}: {
  predictionId: string;
  names: Record<string, string>;
  options: { id: string; name: string }[];
  canRemove?: boolean; // nur der Admin, nur bei nicht aufgelösten Wetten
  onRemoved?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");

  async function load() {
    const supabase = createClient();
    const { data, error: err } = await supabase.rpc("prediction_participants", {
      p_prediction: predictionId,
    });
    setError(err ? err.message : "");
    setRows((data ?? []) as Row[]);
  }

  async function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    await load();
  }

  async function remove(userId: string, stake: number) {
    const who = names[userId] ?? "Spieler";
    if (!confirm(`${who} aus der Wette entfernen? Der Einsatz (${stake} Punkte) wird zurückerstattet.`)) return;
    const supabase = createClient();
    const { error: err } = await supabase.rpc("admin_remove_participant", {
      p_prediction: predictionId,
      p_user: userId,
    });
    if (err) {
      setError(err.message);
      return;
    }
    await load();
    onRemoved?.();
  }

  return (
    <div style={{ marginTop: "12px" }}>
      <button type="button" onClick={toggle} style={ghostButton}>
        {open ? "Teilnehmer ausblenden" : "Teilnehmer anzeigen"}
      </button>
      {open && (
        <div style={{ marginTop: "10px" }}>
          {error && <p style={{ color: "#f87171", margin: 0 }}>{error}</p>}
          {rows && rows.length === 0 && !error && (
            <p style={{ color: "#94a3b8", margin: 0 }}>Noch niemand hat mitgemacht.</p>
          )}
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "6px" }}>
            {(rows ?? []).map((r) => (
              <li
                key={r.user_id}
                style={{ color: "#cbd5e1", fontSize: "14px", display: "flex", gap: "10px", alignItems: "center" }}
              >
                <span style={{ flex: 1 }}>
                  <strong>{names[r.user_id] ?? "Spieler"}</strong>:{" "}
                  {r.option_id
                    ? `«${options.find((o) => o.id === r.option_id)?.name ?? "?"}»`
                    : "dabei (Wahl wird nach Ablauf sichtbar)"}{" "}
                  · {r.stake} Punkte
                </span>
                {canRemove && (
                  <button
                    type="button"
                    onClick={() => remove(r.user_id, r.stake)}
                    style={{
                      background: "none",
                      border: "1px solid #f87171",
                      borderRadius: "6px",
                      color: "#f87171",
                      cursor: "pointer",
                      fontSize: "12px",
                      padding: "4px 8px",
                    }}
                  >
                    Entfernen
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
