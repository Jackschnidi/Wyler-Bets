"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function placeWager(formData: FormData) {
  const optionId = String(formData.get("option_id") ?? "");
  const stake = Number(formData.get("stake"));

  if (!optionId || !Number.isInteger(stake) || stake <= 0) {
    redirect(`/?error=${encodeURIComponent("Bitte Option und gültigen Einsatz wählen")}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("place_wager", {
    p_option: optionId,
    p_stake: stake,
  });

  if (error) {
    redirect(`/?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/");
  redirect("/");
}
