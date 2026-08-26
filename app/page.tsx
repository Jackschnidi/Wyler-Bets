import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, username, experience_points")
    .limit(5);

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
      <div
        style={{
          width: "100%",
          maxWidth: "700px",
          textAlign: "center",
        }}
      >
        <p
          style={{
            marginBottom: "12px",
            fontSize: "14px",
            fontWeight: "bold",
            letterSpacing: "2px",
            color: "#94a3b8",
            textTransform: "uppercase",
          }}
        >
          Willkommen bei
        </p>

        <h1
          style={{
            margin: 0,
            fontSize: "clamp(48px, 10vw, 80px)",
            fontWeight: 800,
          }}
        >
          Wyler Bets
        </h1>

        <p
          style={{
            marginTop: "24px",
            fontSize: "20px",
            lineHeight: 1.6,
            color: "#cbd5e1",
          }}
        >
          Das Prognose-Spiel, bei dem Wissen zählt.
        </p>

        <div
          style={{
            marginTop: "40px",
            padding: "20px",
            borderRadius: "12px",
            background: "#1e293b",
          }}
        >
          {error ? (
            <p style={{ color: "#f87171" }}>
              Supabase-Verbindung fehlgeschlagen.
            </p>
          ) : (
            <p style={{ color: "#4ade80" }}>
              ✓ Supabase-Verbindung funktioniert!
            </p>
          )}

          <p
            style={{
              marginTop: "12px",
              color: "#94a3b8",
              fontSize: "14px",
            }}
          >
            Gefundene Profile: {profiles?.length ?? 0}
          </p>
        </div>
      </div>
    </main>
  );
}
