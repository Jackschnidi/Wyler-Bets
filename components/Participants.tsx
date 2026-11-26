"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ghostButton } from "@/components/ui";

type Row = { user_id: string; option_id: string | null; stake: number };

export default function Participants({
  predictionId,
  names,
  options,
}: {
  predictionId: string;
  names: Record<string, string>;
  options: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");

  async function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    setError("");
    const supabase = createClient();
    const { data, error: err } = await supabase.rpc("prediction_participants", {
      p_prediction: predictionId,
    });
    if (err) setError(err.message);
    setRows((data ?? []) as Row[]);
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
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "4px" }}>
            {(rows ?? []).map((r) => (
              <li key={r.user_id} style={{ color: "#cbd5e1", fontSize: "14px" }}>
                <strong>{names[r.user_id] ?? "Spieler"}</strong>:{" "}
                {r.option_id
                  ? `«${options.find((o) => o.id === r.option_id)?.name ?? "?"}»`
                  : "dabei (Wahl wird nach Ablauf sichtbar)"}{" "}
                · {r.stake} Punkte
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
