-- 004: Admin kann einzelne Spieler aus einer Wette entfernen (Einsatz wird zurückerstattet)

create or replace function public.admin_remove_participant(p_prediction uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_status text;
  v_stake integer;
  v_settled boolean;
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;

  select status into v_status from public.predictions where id = p_prediction;
  if v_status is null then raise exception 'Wette nicht gefunden'; end if;
  if v_status = 'resolved' then raise exception 'Wette ist schon aufgelöst'; end if;

  select stake, settled into v_stake, v_settled
  from public.prediction_answers
  where prediction_id = p_prediction and user_id = p_user;
  if not found then raise exception 'Spieler hat bei dieser Wette nicht mitgemacht'; end if;

  if v_stake is not null and not v_settled then
    insert into public.point_transactions (user_id, amount, reason, created_by)
    values (p_user, v_stake, 'Rückerstattung: aus Wette ' || p_prediction || ' entfernt', auth.uid());
  end if;

  delete from public.prediction_answers where prediction_id = p_prediction and user_id = p_user;
end $$;

revoke all on function public.admin_remove_participant(uuid, uuid) from public, anon;
grant execute on function public.admin_remove_participant(uuid, uuid) to authenticated;
