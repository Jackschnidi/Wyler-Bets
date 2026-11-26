-- 002: Jeder Spieler kann Wetten erstellen und legt den Einsatz fest.
-- Nur der Admin kann Wetten löschen und das Endergebnis eintragen.

-- 1) Einsatz pro Wette (vom Ersteller festgelegt)
alter table public.predictions add column if not exists stake integer not null default 10;
alter table public.predictions drop constraint if exists predictions_stake_check;
alter table public.predictions add constraint predictions_stake_check check (stake > 0);

-- 2) Wette erstellen (jeder eingeloggte Spieler)
create or replace function public.create_prediction(
  p_title text,
  p_description text,
  p_closes_at timestamptz,
  p_stake integer,
  p_options jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_opt jsonb;
  v_count integer;
begin
  if auth.uid() is null then raise exception 'not logged in'; end if;
  if p_title is null or length(trim(p_title)) = 0 then raise exception 'Titel fehlt'; end if;
  if p_stake is null or p_stake <= 0 then raise exception 'Ungültiger Einsatz'; end if;
  if p_closes_at is not null and p_closes_at <= now() then
    raise exception 'Schlusszeit liegt in der Vergangenheit';
  end if;
  if p_options is null or jsonb_typeof(p_options) <> 'array' then raise exception 'Optionen fehlen'; end if;

  v_count := jsonb_array_length(p_options);
  if v_count < 2 or v_count > 10 then raise exception 'Zwischen 2 und 10 Optionen nötig'; end if;

  insert into public.predictions (creator_id, title, description, status, closes_at, stake)
  values (
    auth.uid(),
    trim(p_title),
    nullif(trim(coalesce(p_description, '')), ''),
    'open',
    p_closes_at,
    p_stake
  )
  returning id into v_id;

  for v_opt in select * from jsonb_array_elements(p_options) loop
    if length(trim(coalesce(v_opt->>'name', ''))) = 0 then raise exception 'Option ohne Namen'; end if;
    if coalesce((v_opt->>'odds')::numeric, 0) < 1 then raise exception 'Quote muss mindestens 1 sein'; end if;
    insert into public.prediction_options (prediction_id, name, odds)
    values (v_id, trim(v_opt->>'name'), (v_opt->>'odds')::numeric(6,2));
  end loop;

  return v_id;
end $$;

-- 3) Einsatz setzen: Höhe bestimmt die Wette (nicht mehr der Spieler)
drop function if exists public.place_wager(uuid, integer);

create or replace function public.place_wager(p_option uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_prediction uuid;
  v_odds numeric;
  v_stake integer;
  v_balance integer;
begin
  if auth.uid() is null then raise exception 'not logged in'; end if;

  select o.prediction_id, o.odds, p.stake into v_prediction, v_odds, v_stake
  from public.prediction_options o
  join public.predictions p on p.id = o.prediction_id
  where o.id = p_option
    and p.status = 'open'
    and (p.closes_at is null or p.closes_at > now());
  if v_prediction is null then raise exception 'Wette ist nicht mehr offen'; end if;

  perform 1 from public.profiles where id = auth.uid() for update;

  if exists (
    select 1 from public.prediction_answers
    where prediction_id = v_prediction and user_id = auth.uid()
  ) then raise exception 'Du hast bei dieser Wette schon mitgemacht'; end if;

  select balance into v_balance from public.balances where user_id = auth.uid();
  if coalesce(v_balance, 0) < v_stake then
    raise exception 'Nicht genug Punkte (Einsatz: % Punkte)', v_stake;
  end if;

  insert into public.prediction_answers (prediction_id, option_id, user_id, stake, odds)
  values (v_prediction, p_option, auth.uid(), v_stake, v_odds);

  insert into public.point_transactions (user_id, amount, reason, created_by)
  values (auth.uid(), -v_stake, 'Einsatz auf Wette ' || v_prediction, auth.uid());
end $$;

-- 4) Admin: Wette löschen (offene Einsätze werden zurückerstattet)
create or replace function public.admin_delete_prediction(p_prediction uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_status text;
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;

  select status into v_status from public.predictions where id = p_prediction;
  if v_status is null then raise exception 'Wette nicht gefunden'; end if;

  if v_status <> 'resolved' then
    insert into public.point_transactions (user_id, amount, reason, created_by)
    select user_id, stake, 'Rückerstattung gelöschte Wette ' || p_prediction, auth.uid()
    from public.prediction_answers
    where prediction_id = p_prediction and stake is not null and not settled;
  end if;

  update public.predictions set winning_option_id = null where id = p_prediction;
  delete from public.prediction_answers where prediction_id = p_prediction;
  delete from public.prediction_options where prediction_id = p_prediction;
  delete from public.predictions where id = p_prediction;
end $$;

-- 5) Wetten nur noch über Funktionen ändern (kein direktes Schreiben)
revoke insert, update, delete on public.predictions from anon, authenticated;
revoke insert, update, delete on public.prediction_options from anon, authenticated;

revoke all on function public.create_prediction(text, text, timestamptz, integer, jsonb) from public, anon;
revoke all on function public.place_wager(uuid) from public, anon;
revoke all on function public.admin_delete_prediction(uuid) from public, anon;
grant execute on function public.create_prediction(text, text, timestamptz, integer, jsonb) to authenticated;
grant execute on function public.place_wager(uuid) to authenticated;
grant execute on function public.admin_delete_prediction(uuid) to authenticated;
