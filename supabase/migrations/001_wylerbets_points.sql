-- WylerBets: Punkte-System, Admin-Rolle, Einsätze
-- Baut auf den bestehenden Tabellen profiles, predictions, prediction_options, prediction_answers auf.
-- Im Supabase SQL Editor ausführen.

-- 1) Spalten ergänzen -------------------------------------------------------
alter table public.profiles add column if not exists is_admin boolean not null default false;
alter table public.profiles add column if not exists email text;

alter table public.prediction_options add column if not exists odds numeric(6,2) not null default 2.00;
alter table public.prediction_options drop constraint if exists prediction_options_odds_check;
alter table public.prediction_options add constraint prediction_options_odds_check check (odds >= 1);

alter table public.prediction_answers add column if not exists stake integer check (stake > 0);
alter table public.prediction_answers add column if not exists odds numeric(6,2);
alter table public.prediction_answers add column if not exists settled boolean not null default false;
create unique index if not exists prediction_answers_one_per_user
  on public.prediction_answers (prediction_id, user_id);

-- 2) Punkte-Ledger ------------------------------------------------------------
create table if not exists public.point_transactions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount integer not null,
  reason text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create or replace view public.balances with (security_invoker = true) as
select p.id as user_id, coalesce(sum(t.amount), 0)::int as balance
from public.profiles p
left join public.point_transactions t on t.user_id = p.id
group by p.id;

-- 3) Profil beim ersten Google-Login anlegen -----------------------------------
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
  return new;
end $$;

drop trigger if exists wylerbets_on_auth_user_created on auth.users;
create trigger wylerbets_on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- 4) Admin-Check ----------------------------------------------------------------
create or replace function public.is_admin() returns boolean
language sql security definer set search_path = public stable as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

-- 5) Rechte: Spieler dürfen sich nicht selbst Punkte/Admin geben -----------------
-- Tabellenrechte sind robuster als Policies, falls schon ältere Policies existieren.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (username, avatar_url) on public.profiles to authenticated;

revoke insert, update, delete on public.point_transactions from anon, authenticated;
revoke insert, update, delete on public.prediction_answers from anon, authenticated;

-- 6) RLS ----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.point_transactions enable row level security;
alter table public.predictions enable row level security;
alter table public.prediction_options enable row level security;
alter table public.prediction_answers enable row level security;

drop policy if exists wb_profiles_select on public.profiles;
create policy wb_profiles_select on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());

drop policy if exists wb_profiles_update_own on public.profiles;
create policy wb_profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists wb_tx_select on public.point_transactions;
create policy wb_tx_select on public.point_transactions
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists wb_predictions_select on public.predictions;
create policy wb_predictions_select on public.predictions
  for select to authenticated using (true);
drop policy if exists wb_predictions_admin on public.predictions;
create policy wb_predictions_admin on public.predictions
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin() and creator_id = auth.uid());

drop policy if exists wb_options_select on public.prediction_options;
create policy wb_options_select on public.prediction_options
  for select to authenticated using (true);
drop policy if exists wb_options_admin on public.prediction_options;
create policy wb_options_admin on public.prediction_options
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists wb_answers_select on public.prediction_answers;
create policy wb_answers_select on public.prediction_answers
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- 7) Funktionen ---------------------------------------------------------------------
-- Admin: Punkte gutschreiben (oder mit negativem Wert abziehen)
create or replace function public.admin_add_points(target uuid, delta integer, note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  if delta = 0 then raise exception 'delta must not be 0'; end if;
  insert into public.point_transactions (user_id, amount, reason, created_by)
  values (target, delta, coalesce(note, 'Admin-Buchung'), auth.uid());
end $$;

-- Spieler: Einsatz auf eine Option
create or replace function public.place_wager(p_option uuid, p_stake integer)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_prediction uuid;
  v_odds numeric;
  v_balance integer;
begin
  if auth.uid() is null then raise exception 'not logged in'; end if;
  if p_stake is null or p_stake <= 0 then raise exception 'invalid stake'; end if;

  select o.prediction_id, o.odds into v_prediction, v_odds
  from public.prediction_options o
  join public.predictions p on p.id = o.prediction_id
  where o.id = p_option
    and p.status = 'open'
    and (p.closes_at is null or p.closes_at > now());
  if v_prediction is null then raise exception 'Wette ist nicht mehr offen'; end if;

  -- Profilzeile sperren, damit parallele Einsätze den Kontostand nicht überziehen
  perform 1 from public.profiles where id = auth.uid() for update;

  select balance into v_balance from public.balances where user_id = auth.uid();
  if coalesce(v_balance, 0) < p_stake then raise exception 'Nicht genug Punkte'; end if;

  insert into public.prediction_answers (prediction_id, option_id, user_id, stake, odds)
  values (v_prediction, p_option, auth.uid(), p_stake, v_odds);  -- unique-Index: ein Einsatz pro Wette

  insert into public.point_transactions (user_id, amount, reason, created_by)
  values (auth.uid(), -p_stake, 'Einsatz auf Wette ' || v_prediction, auth.uid());
end $$;

-- Admin: Wette auflösen und Gewinne auszahlen (Einsatz x Quote)
create or replace function public.admin_resolve_prediction(p_prediction uuid, p_winning_option uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;

  if not exists (
    select 1 from public.prediction_options where id = p_winning_option and prediction_id = p_prediction
  ) then raise exception 'option gehört nicht zur Wette'; end if;

  update public.predictions
     set status = 'resolved', winning_option_id = p_winning_option
   where id = p_prediction and status in ('open', 'closed');
  if not found then raise exception 'Wette nicht auflösbar'; end if;

  insert into public.point_transactions (user_id, amount, reason, created_by)
  select user_id, floor(stake * odds)::int, 'Gewinn Wette ' || p_prediction, auth.uid()
  from public.prediction_answers
  where prediction_id = p_prediction
    and option_id = p_winning_option
    and stake is not null and odds is not null
    and not settled;

  update public.prediction_answers set settled = true where prediction_id = p_prediction;
end $$;

revoke all on function public.admin_add_points(uuid, integer, text) from public, anon;
revoke all on function public.admin_resolve_prediction(uuid, uuid) from public, anon;
revoke all on function public.place_wager(uuid, integer) from public, anon;
grant execute on function public.admin_add_points(uuid, integer, text) to authenticated;
grant execute on function public.admin_resolve_prediction(uuid, uuid) to authenticated;
grant execute on function public.place_wager(uuid, integer) to authenticated;

-- 8) Dich selbst zum Admin machen (nach dem ersten Google-Login, E-Mail anpassen):
-- update public.profiles set is_admin = true where email = 'deine@mail.ch';
