import type { Player } from "@/components/types";
import { card } from "@/components/ui";

export default function Leaderboard({ players, myId }: { players: Player[]; myId: string }) {
  // Gleicher Kontostand = gleicher Rang
  const ranked = players.map((p, i) => {
    const firstWithSame = players.findIndex((q) => q.balance === p.balance);
    return { ...p, rank: firstWithSame + 1, index: i };
  });

  return (
    <section style={card}>
      <h2 style={{ margin: "0 0 12px", fontSize: "20px" }}>Rangliste</h2>
      {ranked.length === 0 && <p style={{ color: "#94a3b8" }}>Noch keine Spieler.</p>}
      <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "6px" }}>
        {ranked.map((p) => {
          const me = p.id === myId;
          return (
            <li
              key={p.id}
              style={{
                display: "flex",
                gap: "12px",
                alignItems: "center",
                padding: "10px 12px",
                borderRadius: "8px",
                background: me ? "#0f172a" : "transparent",
                border: me ? "1px solid #4ade80" : "1px solid transparent",
              }}
            >
              <span style={{ width: "32px", color: "#94a3b8", fontWeight: 700 }}>{p.rank}.</span>
              <span style={{ flex: 1, fontWeight: me ? 700 : 400 }}>
                {p.label}
                {me ? " (du)" : ""}
              </span>
              <span style={{ color: "#4ade80", fontWeight: 700 }}>{p.balance} Punkte</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
