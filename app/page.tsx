import { createClient } from "@/lib/supabase/server";
import LoginButton from "@/components/LoginButton";
import { placeWager, signOut } from "./actions";

type OpenPrediction = {
  id: string;
  title: string;
  description: string | null;
  closes_at: string | null;
  prediction_options: { id: string; name: string; odds: number }[];
};

const card = {
  padding: "20px",
  borderRadius: "12px",
  background: "#1e293b",
  textAlign: "left" as const,
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error: errorMessage } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
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
        <div style={{ textAlign: "center", maxWidth: "700px" }}>
          <h1 style={{ margin: 0, fontSize: "clamp(48px, 10vw, 80px)", fontWeight: 800 }}>
            Wyler Bets
          </h1>
          <p style={{ margin: "24px 0 40px", fontSize: "20px", color: "#cbd5e1" }}>
            Das Prognose-Spiel, bei dem Wissen zählt.
          </p>
          <LoginButton />
          {errorMessage && <p style={{ marginTop: "20px", color: "#f87171" }}>{errorMessage}</p>}
        </div>
      </main>
    );
  }

  const [{ data: profile }, { data: balanceRow }, { data: predictions }, { data: answers }] =
    await Promise.all([
      supabase.from("profiles").select("username, is_admin").eq("id", user.id).maybeSingle(),
      supabase.from("balances").select("balance").eq("user_id", user.id).maybeSingle(),
      supabase
        .from("predictions")
        .select("id, title, description, closes_at, prediction_options(id, name, odds)")
        .eq("status", "open")
        .order("closes_at", { ascending: true, nullsFirst: false }),
      supabase
        .from("prediction_answers")
        .select("prediction_id, option_id, stake, odds")
        .eq("user_id", user.id),
    ]);

  const balance = balanceRow?.balance ?? 0;
  const myAnswers = new Map((answers ?? []).map((a) => [a.prediction_id, a]));
  const open = (predictions ?? []) as OpenPrediction[];

  return (
    <main style={{ maxWidth: "700px", margin: "0 auto", padding: "24px" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "28px" }}>Wyler Bets</h1>
        <form action={signOut}>
          <button
            style={{
              background: "transparent",
              color: "#94a3b8",
              border: "1px solid #334155",
              borderRadius: "8px",
              padding: "8px 14px",
              cursor: "pointer",
            }}
          >
            Abmelden
          </button>
        </form>
      </header>

      <div style={{ ...card, marginBottom: "24px" }}>
        <p style={{ margin: 0, color: "#94a3b8", fontSize: "14px" }}>
          Angemeldet als {profile?.username ?? user.email}
        </p>
        <p style={{ margin: "8px 0 0", fontSize: "32px", fontWeight: 800, color: "#4ade80" }}>
          {balance} Punkte
        </p>
      </div>

      {errorMessage && (
        <p style={{ color: "#f87171", marginBottom: "16px" }}>{errorMessage}</p>
      )}

      <h2 style={{ fontSize: "20px", marginBottom: "12px" }}>Offene Wetten</h2>

      {open.length === 0 && <p style={{ color: "#94a3b8" }}>Zurzeit gibt es keine offenen Wetten.</p>}

      <div style={{ display: "grid", gap: "16px" }}>
        {open.map((p) => {
          const mine = myAnswers.get(p.id);
          const myOption = p.prediction_options.find((o) => o.id === mine?.option_id);

          return (
            <section key={p.id} style={card}>
              <h3 style={{ margin: 0 }}>{p.title}</h3>
              {p.description && (
                <p style={{ margin: "8px 0 0", color: "#cbd5e1" }}>{p.description}</p>
              )}
              {p.closes_at && (
                <p style={{ margin: "8px 0 0", color: "#94a3b8", fontSize: "14px" }}>
                  Schliesst: {new Date(p.closes_at).toLocaleString("de-CH")}
                </p>
              )}

              {mine ? (
                <p style={{ marginTop: "16px", color: "#4ade80" }}>
                  Dein Einsatz: {mine.stake} Punkte auf «{myOption?.name}» (Quote {mine.odds})
                </p>
              ) : (
                <form action={placeWager} style={{ marginTop: "16px", display: "grid", gap: "10px" }}>
                  {p.prediction_options.map((o) => (
                    <label key={o.id} style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                      <input type="radio" name="option_id" value={o.id} required />
                      <span>{o.name}</span>
                      <span style={{ marginLeft: "auto", color: "#94a3b8" }}>Quote {o.odds}</span>
                    </label>
                  ))}
                  <div style={{ display: "flex", gap: "10px", marginTop: "6px" }}>
                    <input
                      type="number"
                      name="stake"
                      min={1}
                      max={Math.max(balance, 1)}
                      step={1}
                      required
                      placeholder="Einsatz"
                      style={{
                        flex: 1,
                        padding: "10px",
                        borderRadius: "8px",
                        border: "1px solid #334155",
                        background: "#0f172a",
                        color: "#f8fafc",
                      }}
                    />
                    <button
                      style={{
                        padding: "10px 18px",
                        borderRadius: "8px",
                        border: "none",
                        background: "#4ade80",
                        color: "#0f172a",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Wetten
                    </button>
                  </div>
                </form>
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}
