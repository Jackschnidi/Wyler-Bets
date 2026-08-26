export default function Home() {
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
            display: "flex",
            justifyContent: "center",
            gap: "12px",
            marginTop: "32px",
          }}
        >
          <button
            style={{
              padding: "14px 24px",
              border: 0,
              borderRadius: "10px",
              background: "#f8fafc",
              color: "#0f172a",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Anmelden
          </button>

          <button
            style={{
              padding: "14px 24px",
              border: "1px solid #334155",
              borderRadius: "10px",
              background: "transparent",
              color: "#f8fafc",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Prognosen entdecken
          </button>
        </div>
      </div>
    </main>
  );
}
