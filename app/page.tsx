"use client";

import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import AuthForm from "@/components/AuthForm";
import NewPasswordForm from "@/components/NewPasswordForm";
import Leaderboard from "@/components/Leaderboard";
import FinishedBets from "@/components/FinishedBets";
import Participants from "@/components/Participants";
import Comments from "@/components/Comments";
import ProfileSettings from "@/components/ProfileSettings";
import AdminPoints from "@/components/AdminPoints";
import type { MyAnswer, Option, Player } from "@/components/types";
import { card, dangerButton, ghostButton, input, primaryButton } from "@/components/ui";

type OpenPrediction = {
  id: string;
  title: string;
  description: string | null;
  closes_at: string | null;
  stake: number;
  status: string;
  creator_id: string | null;
  proposed_option_id: string | null;
  options: Option[];
};

type NewOption = { name: string; odds: string };
type Tab = "bets" | "finished" | "ranking" | "profile" | "admin";

const MAX_STAKE = 500; // höchster Einsatz pro Wette

export default function Home() {
  // undefined = Session wird noch geladen, null = nicht eingeloggt
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [recovery, setRecovery] = useState(false); // Passwort-Zurücksetzen-Link wurde geöffnet
  const [tab, setTab] = useState<Tab>("bets");
  const [name, setName] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [balance, setBalance] = useState(0);
  const [predictions, setPredictions] = useState<OpenPrediction[]>([]);
  const [answers, setAnswers] = useState<MyAnswer[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  // Formular: neue Wette
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [stake, setStake] = useState("10");
  const [newOptions, setNewOptions] = useState<NewOption[]>([
    { name: "", odds: "2" },
    { name: "", odds: "2" },
  ]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const load = useCallback(async (s: Session) => {
    const supabase = createClient();
    const userId = s.user.id;

    const [profile, bal, preds, ans, board] = await Promise.all([
      supabase.from("profiles").select("username, is_admin").eq("id", userId).maybeSingle(),
      supabase.from("balances").select("balance").eq("user_id", userId).maybeSingle(),
      supabase
        .from("predictions")
        .select("id, title, description, closes_at, stake, status, creator_id, proposed_option_id")
        .in("status", ["open", "closed"])
        .order("closes_at", { ascending: true, nullsFirst: false }),
      supabase
        .from("prediction_answers")
        .select("prediction_id, option_id, stake, odds")
        .eq("user_id", userId),
      supabase.rpc("leaderboard"),
    ]);

    // Optionen separat laden (vermeidet mehrdeutige Beziehungen in der Datenbank)
    const ids = (preds.data ?? []).map((p) => p.id as string);
    const opts = ids.length
      ? await supabase
          .from("prediction_options")
          .select("id, prediction_id, name, odds")
          .in("prediction_id", ids)
      : { data: [] as Option[], error: null };

    const firstError =
      profile.error ?? bal.error ?? preds.error ?? ans.error ?? opts.error ?? board.error;
    setError(firstError ? firstError.message : "");

    const optionList = (opts.data ?? []) as Option[];
    setName(profile.data?.username ?? s.user.email ?? "");
    setIsAdmin(Boolean(profile.data?.is_admin));
    setBalance(bal.data?.balance ?? 0);
    setPredictions(
      (preds.data ?? []).map((p) => ({
        id: p.id as string,
        title: p.title as string,
        description: (p.description as string | null) ?? null,
        closes_at: (p.closes_at as string | null) ?? null,
        stake: Number(p.stake),
        status: p.status as string,
        creator_id: (p.creator_id as string | null) ?? null,
        proposed_option_id: (p.proposed_option_id as string | null) ?? null,
        options: optionList.filter((o) => o.prediction_id === p.id),
      }))
    );
    setAnswers((ans.data ?? []) as MyAnswer[]);
    setPlayers(
      ((board.data ?? []) as { user_id: string; username: string; balance: number }[]).map((r) => ({
        id: r.user_id,
        label: r.username,
        balance: Number(r.balance),
      }))
    );
  }, []);

  useEffect(() => {
    if (session) load(session);
  }, [session, load]);

  async function run(action: () => PromiseLike<{ error: { message: string } | null }>, ok: string) {
    if (!session) return false;
    setError("");
    setInfo("");
    const { error: err } = await action();
    if (err) {
      setError(err.message);
      return false;
    }
    setInfo(ok);
    await load(session);
    return true;
  }

  async function onWager(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const optionId = String(new FormData(e.currentTarget).get("option_id") ?? "");
    if (!optionId) {
      setError("Bitte eine Option wählen");
      return;
    }
    const supabase = createClient();
    await run(() => supabase.rpc("place_wager", { p_option: optionId }), "Einsatz gesetzt");
  }

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const stakeNum = Number(stake);
    const options = newOptions
      .map((o) => ({ name: o.name.trim(), odds: Number(o.odds) }))
      .filter((o) => o.name.length > 0);

    if (!title.trim()) return setError("Bitte einen Titel eingeben");
    if (!Number.isInteger(stakeNum) || stakeNum <= 0) return setError("Einsatz muss eine ganze Zahl über 0 sein");
    if (stakeNum > MAX_STAKE) return setError(`Der Einsatz darf höchstens ${MAX_STAKE} Punkte betragen`);
    if (options.length < 2) return setError("Mindestens 2 Optionen nötig");
    if (options.some((o) => !(o.odds >= 1))) return setError("Quoten müssen mindestens 1 sein");

    const supabase = createClient();
    const ok = await run(
      () =>
        supabase.rpc("create_prediction", {
          p_title: title,
          p_description: description,
          p_closes_at: closesAt ? new Date(closesAt).toISOString() : null,
          p_stake: stakeNum,
          p_options: options,
        }),
      "Wette erstellt"
    );
    if (ok) {
      setTitle("");
      setDescription("");
      setClosesAt("");
      setStake("10");
      setNewOptions([
        { name: "", odds: "2" },
        { name: "", odds: "2" },
      ]);
    }
  }

  async function onPropose(e: React.FormEvent<HTMLFormElement>, predictionId: string) {
    e.preventDefault();
    const option = String(new FormData(e.currentTarget).get("proposed") ?? "");
    if (!option) return setError("Bitte die richtige Antwort wählen");
    if (!confirm("Ergebnis vorschlagen? Danach kann niemand mehr wetten, der Admin bestätigt das Ergebnis.")) return;
    const supabase = createClient();
    await run(
      () => supabase.rpc("propose_result", { p_prediction: predictionId, p_option: option }),
      "Ergebnis vorgeschlagen, der Admin bestätigt es"
    );
  }

  async function onResolve(e: React.FormEvent<HTMLFormElement>, predictionId: string) {
    e.preventDefault();
    const winning = String(new FormData(e.currentTarget).get("winning") ?? "");
    if (!winning) return setError("Bitte die richtige Antwort wählen");
    if (!confirm("Wette auflösen und Gewinne auszahlen? Das kann nicht rückgängig gemacht werden.")) return;
    const supabase = createClient();
    await run(
      () => supabase.rpc("admin_resolve_prediction", { p_prediction: predictionId, p_winning_option: winning }),
      "Wette aufgelöst, Gewinne ausgezahlt"
    );
  }

  async function onDelete(predictionId: string) {
    if (!confirm("Wette löschen? Bereits gesetzte Einsätze werden zurückerstattet.")) return;
    const supabase = createClient();
    await run(
      () => supabase.rpc("admin_delete_prediction", { p_prediction: predictionId }),
      "Wette gelöscht, Einsätze zurückerstattet"
    );
  }

  async function onLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setError("");
    setInfo("");
    setTab("bets");
  }

  if (session === undefined) {
    return <main style={{ padding: "48px", textAlign: "center", color: "#94a3b8" }}>Lade …</main>;
  }

  if (session && recovery) {
    return <NewPasswordForm onDone={() => setRecovery(false)} />;
  }

  if (session === null) {
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
        <div style={{ textAlign: "center", maxWidth: "700px", width: "100%" }}>
          <h1 style={{ margin: 0, fontSize: "clamp(48px, 10vw, 80px)", fontWeight: 800 }}>Wyler Bets</h1>
          <p style={{ margin: "24px 0 40px", fontSize: "20px", color: "#cbd5e1" }}>
            Das Prognose-Spiel, bei dem Wissen zählt.
          </p>
          <AuthForm />
        </div>
      </main>
    );
  }

  const userId = session.user.id;
  const myAnswers = new Map(answers.map((a) => [a.prediction_id, a]));
  const names: Record<string, string> = Object.fromEntries(players.map((p) => [p.id, p.label]));
  const tabs: [Tab, string][] = [
    ["bets", "Wetten"],
    ["finished", "Beendet"],
    ["ranking", "Rangliste"],
    ["profile", "Profil"],
    ...(isAdmin ? ([["admin", "Admin"]] as [Tab, string][]) : []),
  ];

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
        <button onClick={onLogout} style={ghostButton}>
          Abmelden
        </button>
      </header>

      <div style={{ ...card, marginBottom: "16px" }}>
        <p style={{ margin: 0, color: "#94a3b8", fontSize: "14px" }}>
          Angemeldet als {name}
          {isAdmin ? " (Admin)" : ""}
        </p>
        <p style={{ margin: "8px 0 0", fontSize: "32px", fontWeight: 800, color: "#4ade80" }}>
          {balance} Punkte
        </p>
      </div>

      <nav style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "20px" }}>
        {tabs.map(([key, label]) => (
          <button
            key={key}
            onClick={() => {
              setTab(key);
              setError("");
              setInfo("");
            }}
            style={{
              padding: "8px 14px",
              borderRadius: "8px",
              border: "1px solid #334155",
              background: tab === key ? "#f8fafc" : "transparent",
              color: tab === key ? "#0f172a" : "#cbd5e1",
              fontWeight: tab === key ? 700 : 400,
              cursor: "pointer",
            }}
          >
            {label}
          </button>
        ))}
      </nav>

      {error && <p style={{ color: "#f87171", marginBottom: "16px" }}>{error}</p>}
      {info && <p style={{ color: "#4ade80", marginBottom: "16px" }}>{info}</p>}

      {tab === "ranking" && <Leaderboard players={players} myId={userId} />}

      {tab === "finished" && <FinishedBets userId={userId} isAdmin={isAdmin} names={names} answers={answers} />}

      {tab === "profile" && (
        <ProfileSettings
          email={session.user.email ?? ""}
          currentName={name}
          onSaved={() => load(session)}
        />
      )}

      {tab === "admin" && isAdmin && <AdminPoints players={players} onDone={() => load(session)} />}

      {tab === "bets" && (
        <>
          {/* Neue Wette erstellen (alle Spieler) */}
          <details style={{ ...card, marginBottom: "24px" }}>
            <summary style={{ cursor: "pointer", fontWeight: 700 }}>Neue Wette erstellen</summary>
            <form onSubmit={onCreate} style={{ display: "grid", gap: "10px", marginTop: "16px" }}>
              <input style={input} placeholder="Titel" value={title} onChange={(e) => setTitle(e.target.value)} />
              <textarea
                style={{ ...input, minHeight: "70px" }}
                placeholder="Beschreibung (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <label style={{ color: "#94a3b8", fontSize: "14px" }}>
                Schliesst am (optional)
                <input
                  type="datetime-local"
                  style={{ ...input, marginTop: "4px" }}
                  value={closesAt}
                  onChange={(e) => setClosesAt(e.target.value)}
                />
              </label>
              <label style={{ color: "#94a3b8", fontSize: "14px" }}>
                Einsatz pro Spieler (Punkte), höchstens {MAX_STAKE}
                <input
                  type="number"
                  min={1}
                  max={MAX_STAKE}
                  step={1}
                  style={{ ...input, marginTop: "4px" }}
                  value={stake}
                  onChange={(e) => setStake(e.target.value)}
                />
              </label>

              <p style={{ margin: "6px 0 0", color: "#94a3b8", fontSize: "14px" }}>Optionen mit Quote</p>
              {newOptions.map((o, i) => (
                <div key={i} style={{ display: "flex", gap: "10px" }}>
                  <input
                    style={{ ...input, flex: 3 }}
                    placeholder={`Option ${i + 1}`}
                    value={o.name}
                    onChange={(e) =>
                      setNewOptions(newOptions.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                    }
                  />
                  <input
                    style={{ ...input, flex: 1 }}
                    type="number"
                    min={1}
                    step={0.05}
                    value={o.odds}
                    onChange={(e) =>
                      setNewOptions(newOptions.map((x, j) => (j === i ? { ...x, odds: e.target.value } : x)))
                    }
                  />
                </div>
              ))}
              <div style={{ display: "flex", gap: "10px" }}>
                {newOptions.length < 6 && (
                  <button
                    type="button"
                    onClick={() => setNewOptions([...newOptions, { name: "", odds: "2" }])}
                    style={ghostButton}
                  >
                    + Option
                  </button>
                )}
                <button type="submit" style={primaryButton}>
                  Wette erstellen
                </button>
              </div>
            </form>
          </details>

          <h2 style={{ fontSize: "20px", marginBottom: "12px" }}>Offene Wetten</h2>

          {predictions.length === 0 && <p style={{ color: "#94a3b8" }}>Zurzeit gibt es keine offenen Wetten.</p>}

          <div style={{ display: "grid", gap: "16px" }}>
            {predictions.map((p) => {
              const mine = myAnswers.get(p.id);
              const myOption = p.options.find((o) => o.id === mine?.option_id);
              const timeUp = p.closes_at ? new Date(p.closes_at) <= new Date() : false;
              const closed = p.status === "closed" || timeUp;
              const proposed = p.options.find((o) => o.id === p.proposed_option_id);
              const iAmCreator = p.creator_id === userId;
              const canPropose = iAmCreator && (p.closes_at === null || timeUp);

              return (
                <section key={p.id} style={card}>
                  <h3 style={{ margin: 0 }}>{p.title}</h3>
                  {p.description && <p style={{ margin: "8px 0 0", color: "#cbd5e1" }}>{p.description}</p>}
                  <p style={{ margin: "8px 0 0", color: "#94a3b8", fontSize: "14px" }}>
                    Einsatz: {p.stake} Punkte
                    {p.creator_id && names[p.creator_id] ? ` · von ${names[p.creator_id]}` : ""}
                    {p.closes_at && (
                      <>
                        {" · "}
                        {timeUp ? "Geschlossen seit" : "Schliesst"}: {new Date(p.closes_at).toLocaleString("de-CH")}
                      </>
                    )}
                  </p>

                  {mine ? (
                    <p style={{ marginTop: "16px", color: "#4ade80" }}>
                      Dein Einsatz: {mine.stake} Punkte auf «{myOption?.name}» (Quote {mine.odds})
                    </p>
                  ) : closed ? (
                    <p style={{ marginTop: "16px", color: "#94a3b8" }}>Es kann nicht mehr gewettet werden.</p>
                  ) : (
                    <form onSubmit={onWager} style={{ marginTop: "16px", display: "grid", gap: "10px" }}>
                      {p.options.map((o) => (
                        <label key={o.id} style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                          <input type="radio" name="option_id" value={o.id} required />
                          <span>{o.name}</span>
                          <span style={{ marginLeft: "auto", color: "#94a3b8" }}>Quote {o.odds}</span>
                        </label>
                      ))}
                      <button type="submit" style={{ ...primaryButton, marginTop: "6px" }}>
                        Mit {p.stake} Punkten wetten
                      </button>
                    </form>
                  )}

                  {proposed && (
                    <p style={{ marginTop: "14px", color: "#facc15", fontSize: "14px" }}>
                      Vorschlag des Erstellers: «{proposed.name}». Der Admin muss das Ergebnis noch bestätigen.
                    </p>
                  )}

                  {canPropose && (
                    <form
                      key={`propose-${p.id}-${p.proposed_option_id ?? ""}`}
                      onSubmit={(e) => onPropose(e, p.id)}
                      style={{ marginTop: "14px", display: "flex", gap: "10px", flexWrap: "wrap" }}
                    >
                      <select
                        name="proposed"
                        defaultValue={p.proposed_option_id ?? ""}
                        style={{ ...input, flex: 1, minWidth: "160px" }}
                      >
                        <option value="" disabled>
                          Richtige Antwort vorschlagen
                        </option>
                        {p.options.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name}
                          </option>
                        ))}
                      </select>
                      <button type="submit" style={ghostButton}>
                        {p.proposed_option_id ? "Vorschlag ändern" : "Ergebnis vorschlagen"}
                      </button>
                    </form>
                  )}

                  <Participants
                    predictionId={p.id}
                    names={names}
                    options={p.options}
                    canRemove={isAdmin}
                    onRemoved={() => load(session)}
                  />
                  <Comments predictionId={p.id} userId={userId} isAdmin={isAdmin} names={names} />

                  {isAdmin && (
                    <div style={{ marginTop: "20px", paddingTop: "16px", borderTop: "1px solid #334155" }}>
                      <p style={{ margin: "0 0 10px", color: "#94a3b8", fontSize: "14px" }}>Admin</p>
                      <form
                        key={`resolve-${p.id}-${p.proposed_option_id ?? ""}`}
                        onSubmit={(e) => onResolve(e, p.id)}
                        style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}
                      >
                        <select
                          name="winning"
                          defaultValue={p.proposed_option_id ?? ""}
                          style={{ ...input, flex: 1, minWidth: "160px" }}
                        >
                          <option value="" disabled>
                            Richtige Antwort wählen
                          </option>
                          {p.options.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.name}
                            </option>
                          ))}
                        </select>
                        <button type="submit" style={primaryButton}>
                          {proposed ? "Bestätigen" : "Auflösen"}
                        </button>
                        <button type="button" onClick={() => onDelete(p.id)} style={dangerButton}>
                          Löschen
                        </button>
                      </form>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}
