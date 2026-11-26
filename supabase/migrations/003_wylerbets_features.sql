-- 003: Alle Funktionen in einem Skript (voraussetzung: 001 wurde ausgeführt).
-- Enthält auch den Inhalt von 002, kann also mehrfach und unabhängig von 002 ausgeführt werden.
--   - Jeder kann Wetten erstellen (Einsatz höchstens 500 Punkte, vom Ersteller festgelegt)
--   - Admin löscht Wetten / trägt Endergebnis ein, Ersteller schlägt Ergebnis vor
--   - Startguthaben 1000, Rangliste, Teilnehmer pro Wette, Kommentare, Profil bearbeiten

-- 1) Einsatz pro Wette (1 bis 500 Punkte) ---------------------------------------------
alter table public.predictions add column if not exists stake integer not null default 10;
alter table public.predictions drop constraint if exists predictions_stake_check;
alter table public.predictions add constraint predictions_stake_check check (stake > 0 and stake <= 500);
alter table public.predictions add column if not exists proposed_option_id uuid;

drop function if exists public.max_stake();

-- 2) Startguthaben: neue Konten bekommen automatisch 1000 Punkte ------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, username, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;

  if found then
    insert into public.point_transactions (user_id, amount, reason)
    values (new.id, 1000, 'Startguthaben');
  end if;

  return new;
end $$;

-- 3) Wette erstellen (jeder eingeloggte Spieler) ------------------------------------------
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
  if p_stake > 500 then raise exception 'Einsatz zu hoch: maximal 500 Punkte'; end if;

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

-- 4) Einsatz setzen: Höhe bestimmt die Wette --------------------------------------------------
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

-- 5) Admin: Wette löschen (offene Einsätze werden zurückerstattet) ------------------------------
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

-- 6) Ergebnis vorschlagen (nur der Ersteller, nach Ablauf der Wettzeit) -------------------------
create or replace function public.propose_result(p_prediction uuid, p_option uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_creator uuid;
  v_status text;
  v_closes timestamptz;
begin
  if auth.uid() is null then raise exception 'not logged in'; end if;

  select creator_id, status, closes_at into v_creator, v_status, v_closes
  from public.predictions where id = p_prediction;
  if not found then raise exception 'Wette nicht gefunden'; end if;

  if v_creator is distinct from auth.uid() then
    raise exception 'Nur der Ersteller kann ein Ergebnis vorschlagen';
  end if;
  if v_status not in ('open', 'closed') then raise exception 'Wette ist schon aufgelöst'; end if;
  if v_closes is not null and v_closes > now() then raise exception 'Die Wette läuft noch'; end if;

  if not exists (
    select 1 from public.prediction_options where id = p_option and prediction_id = p_prediction
  ) then raise exception 'Option gehört nicht zur Wette'; end if;

  update public.predictions
     set proposed_option_id = p_option, status = 'closed'
   where id = p_prediction;
end $$;

-- 7) Kommentare ------------------------------------------------------------------------------------
create table if not exists public.prediction_comments (
  id bigint generated always as identity primary key,
  prediction_id uuid not null references public.predictions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists prediction_comments_prediction_idx
  on public.prediction_comments (prediction_id, created_at);

alter table public.prediction_comments enable row level security;
revoke all on public.prediction_comments from anon;
revoke insert, update, delete on public.prediction_comments from authenticated;

drop policy if exists wb_comments_select on public.prediction_comments;
create policy wb_comments_select on public.prediction_comments
  for select to authenticated using (true);

create or replace function public.add_comment(p_prediction uuid, p_body text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not logged in'; end if;
  if p_body is null or length(trim(p_body)) = 0 then raise exception 'Kommentar ist leer'; end if;
  if length(p_body) > 500 then raise exception 'Kommentar ist zu lang (max. 500 Zeichen)'; end if;
  if not exists (select 1 from public.predictions where id = p_prediction) then
    raise exception 'Wette nicht gefunden';
  end if;
  insert into public.prediction_comments (prediction_id, user_id, body)
  values (p_prediction, auth.uid(), trim(p_body));
end $$;

create or replace function public.delete_comment(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not logged in'; end if;
  delete from public.prediction_comments
   where id = p_id and (user_id = auth.uid() or public.is_admin());
end $$;

-- 8) Rangliste ----------------------------------------------------------------------------------------
create or replace function public.leaderboard()
returns table (user_id uuid, username text, balance integer)
language sql security definer set search_path = public stable as $$
  select p.id,
         coalesce(p.username, split_part(p.email, '@', 1), 'Spieler'),
         coalesce(sum(t.amount), 0)::int
  from public.profiles p
  left join public.point_transactions t on t.user_id = p.id
  group by p.id, p.username, p.email
  order by 3 desc, 2
$$;

-- 9) Teilnehmer pro Wette (Wahl erst sichtbar, wenn die Wette geschlossen ist) ------------------------
create or replace function public.prediction_participants(p_prediction uuid)
returns table (user_id uuid, option_id uuid, stake integer)
language plpgsql security definer set search_path = public stable as $$
declare
  v_revealed boolean;
begin
  select (status <> 'open' or (closes_at is not null and closes_at <= now()))
    into v_revealed
  from public.predictions where id = p_prediction;

  if v_revealed is null then return; end if;

  return query
    select a.user_id,
           case when v_revealed then a.option_id else null end,
           a.stake
    from public.prediction_answers a
    where a.prediction_id = p_prediction and a.stake is not null
    order by a.created_at;
end $$;

-- 10) Profil bearbeiten: Benutzername ------------------------------------------------------------------
create or replace function public.update_username(p_name text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v text := trim(coalesce(p_name, ''));
begin
  if auth.uid() is null then raise exception 'not logged in'; end if;
  if length(v) < 2 or length(v) > 30 then
    raise exception 'Der Benutzername muss 2 bis 30 Zeichen lang sein';
  end if;
  if exists (
    select 1 from public.profiles where lower(username) = lower(v) and id <> auth.uid()
  ) then raise exception 'Dieser Benutzername ist schon vergeben'; end if;

  update public.profiles set username = v where id = auth.uid();
end $$;

-- 11) Direktes Schreiben sperren: alles läuft über die Funktionen ----------------------------------------
revoke update on public.profiles from authenticated;
revoke insert, update, delete on public.predictions from anon, authenticated;
revoke insert, update, delete on public.prediction_options from anon, authenticated;

-- 12) Rechte für die Funktionen ---------------------------------------------------------------------------
revoke all on function public.create_prediction(text, text, timestamptz, integer, jsonb) from public, anon;
revoke all on function public.place_wager(uuid) from public, anon;
revoke all on function public.admin_delete_prediction(uuid) from public, anon;
revoke all on function public.propose_result(uuid, uuid) from public, anon;
revoke all on function public.add_comment(uuid, text) from public, anon;
revoke all on function public.delete_comment(bigint) from public, anon;
revoke all on function public.leaderboard() from public, anon;
revoke all on function public.prediction_participants(uuid) from public, anon;
revoke all on function public.update_username(text) from public, anon;

grant execute on function public.create_prediction(text, text, timestamptz, integer, jsonb) to authenticated;
grant execute on function public.place_wager(uuid) to authenticated;
grant execute on function public.admin_delete_prediction(uuid) to authenticated;
grant execute on function public.propose_result(uuid, uuid) to authenticated;
grant execute on function public.add_comment(uuid, text) to authenticated;
grant execute on function public.delete_comment(bigint) to authenticated;
grant execute on function public.leaderboard() to authenticated;
grant execute on function public.prediction_participants(uuid) to authenticated;
grant execute on function public.update_username(text) to authenticated;
