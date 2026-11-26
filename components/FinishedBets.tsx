"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { MyAnswer, Option } from "@/components/types";
import { card } from "@/components/ui";
import Participants from "@/components/Participants";
import Comments from "@/components/Comments";

type Finished = {
  id: string;
  title: string;
  description: string | null;
  stake: number;
  winning_option_id: string | null;
  options: Option[];
};

export default function FinishedBets({
  userId,
  isAdmin,
  names,
  answers,
}: {
  userId: string;
  isAdmin: boolean;
  names: Record<string, string>;
  answers: MyAnswer[];
}) {
  const [items, setItems] = useState<Finished[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const preds = await supabase
        .from("predictions")
        .select("id, title, description, stake, winning_option_id")
        .eq("status", "resolved")
        .order("created_at", { ascending: false })
        .limit(30);
      if (preds.error) {
        setError(preds.error.message);
        setItems([]);
        return;
      }
      const ids = (preds.data ?? []).map((p) => p.id as string);
      const opts = ids.length
        ? await supabase
            .from("prediction_options")
            .select("id, prediction_id, name, odds")
            .in("prediction_id", ids)
        : { data: [] as Option[], error: null };
      if (opts.error) setError(opts.error.message);

      const optionList = (opts.data ?? []) as Option[];
      setItems(
        (preds.data ?? []).map((p) => ({
          id: p.id as string,
          title: p.title as string,
          description: (p.description as string | null) ?? null,
          stake: Number(p.stake),
          winning_option_id: (p.winning_option_id as string | null) ?? null,
          options: optionList.filter((o) => o.prediction_id === p.id),
        }))
      );
    })();
  }, []);

  if (items === null) return <p style={{ color: "#94a3b8" }}>Lade …</p>;

  const mine = new Map(answers.map((a) => [a.prediction_id, a]));

  return (
    <div style={{ display: "grid", gap: "16px" }}>
      {error && <p style={{ color: "#f87171" }}>{error}</p>}
      {items.length === 0 && !error && <p style={{ color: "#94a3b8" }}>Noch keine beendeten Wetten.</p>}

      {items.map((p) => {
        const winner = p.options.find((o) => o.id === p.winning_option_id);
        const a = mine.get(p.id);
        const myOption = p.options.find((o) => o.id === a?.option_id);
        const won = a && a.option_id === p.winning_option_id;
        const stake = a?.stake ?? 0;
        const payout = a && won ? Math.floor(stake * Number(a.odds ?? 0)) : 0;

        return (
          <section key={p.id} style={card}>
            <h3 style={{ margin: 0 }}>{p.title}</h3>
            {p.description && <p style={{ margin: "8px 0 0", color: "#cbd5e1" }}>{p.description}</p>}
            <p style={{ margin: "10px 0 0" }}>
              Richtige Antwort: <strong style={{ color: "#4ade80" }}>{winner?.name ?? "–"}</strong>
            </p>

            {!a && <p style={{ margin: "8px 0 0", color: "#94a3b8" }}>Du hast nicht teilgenommen.</p>}
            {a && won && (
              <p style={{ margin: "8px 0 0", color: "#4ade80" }}>
                Gewonnen: du hattest «{myOption?.name}» getippt, {stake} Punkte eingesetzt und bekommst{" "}
                {payout} Punkte (Gewinn: +{payout - stake}).
              </p>
            )}
            {a && !won && (
              <p style={{ margin: "8px 0 0", color: "#f87171" }}>
                Verloren: du hattest «{myOption?.name}» getippt ({stake} Punkte Einsatz).
              </p>
            )}

            <Participants predictionId={p.id} names={names} options={p.options} />
            <Comments predictionId={p.id} userId={userId} isAdmin={isAdmin} names={names} />
          </section>
        );
      })}
    </div>
  );
}
