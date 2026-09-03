alter table public.game_rooms drop constraint if exists game_rooms_game_type_check;
alter table public.game_rooms add constraint game_rooms_game_type_check
  check (game_type in ('blackjack','dice','poker','dominos','super_strike'));

create or replace function public.super_strike_room_payload(p_room_id uuid)
returns jsonb language sql security definer set search_path = '' as $$
  select jsonb_build_object(
    'code', r.room_code, 'status', r.status,
    'winner', case when r.status='finished' then
      (select gp.user_id::text from public.game_players gp where gp.room_id=r.id order by gp.score desc,gp.joined_at limit 1)
      else null end,
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',gp.user_id::text,'name',coalesce(p.display_name,'HYPHSWORLD Bowler'),
        'score',gp.score,
        'current_frame',coalesce((s.state->'progress'->gp.user_id::text->>'current_frame')::integer,0),
        'finished',coalesce((s.state->'progress'->gp.user_id::text->>'finished')::boolean,false),
        'is_host',gp.user_id=r.host_id) order by gp.seat_number)
      from public.game_players gp
      left join public.profiles p on p.id=gp.user_id
      left join public.game_state s on s.room_id=r.id
      where gp.room_id=r.id and gp.status<>'left'), '[]'::jsonb))
  from public.game_rooms r
  where r.id=p_room_id and r.game_type='super_strike'
    and exists(select 1 from public.game_players me where me.room_id=r.id and me.user_id=(select auth.uid()) and me.status<>'left');
$$;

create or replace function public.create_super_strike_room()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid := (select auth.uid()); v_room public.game_rooms;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  insert into public.profiles(id) values(v_user) on conflict(id) do nothing;
  insert into public.game_rooms(game_type,host_id,max_players) values('super_strike',v_user,2) returning * into v_room;
  insert into public.game_players(room_id,user_id,seat_number,status) values(v_room.id,v_user,1,'joined');
  insert into public.game_state(room_id,state,updated_by) values(v_room.id,'{"progress":{}}'::jsonb,v_user);
  return public.super_strike_room_payload(v_room.id);
end $$;

create or replace function public.join_super_strike_room(p_room_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid := (select auth.uid()); v_room public.game_rooms; v_count integer;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  select * into v_room from public.game_rooms where room_code=upper(trim(p_room_code)) and game_type='super_strike' and status in ('waiting','playing');
  if v_room.id is null then raise exception 'room_not_found'; end if;
  select count(*) into v_count from public.game_players where room_id=v_room.id and status<>'left';
  if v_count>=2 and not exists(select 1 from public.game_players where room_id=v_room.id and user_id=v_user) then raise exception 'room_full'; end if;
  insert into public.profiles(id) values(v_user) on conflict(id) do nothing;
  insert into public.game_players(room_id,user_id,seat_number,status) values(v_room.id,v_user,2,'joined')
    on conflict(room_id,user_id) do update set status='joined';
  update public.game_rooms set status='playing',updated_at=now() where id=v_room.id;
  return public.super_strike_room_payload(v_room.id);
end $$;

create or replace function public.get_super_strike_room(p_room_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_room_id uuid;
begin
  select id into v_room_id from public.game_rooms where room_code=upper(trim(p_room_code)) and game_type='super_strike';
  if v_room_id is null then raise exception 'room_not_found'; end if;
  return public.super_strike_room_payload(v_room_id);
end $$;

create or replace function public.update_super_strike_room(p_room_code text,p_score integer,p_current_frame integer,p_finished boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid := (select auth.uid()); v_room public.game_rooms; v_state jsonb;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  select * into v_room from public.game_rooms where room_code=upper(trim(p_room_code)) and game_type='super_strike';
  if v_room.id is null or not exists(select 1 from public.game_players where room_id=v_room.id and user_id=v_user and status<>'left') then raise exception 'not_room_player'; end if;
  update public.game_players set score=greatest(coalesce(p_score,0),0),status=case when p_finished then 'ready' else 'playing' end where room_id=v_room.id and user_id=v_user;
  select state into v_state from public.game_state where room_id=v_room.id for update;
  v_state:=jsonb_set(coalesce(v_state,'{}'::jsonb),array['progress',v_user::text],
    jsonb_build_object('current_frame',least(greatest(coalesce(p_current_frame,0),0),10),'finished',coalesce(p_finished,false)),true);
  update public.game_state set state=v_state,updated_by=v_user,updated_at=now(),version=version+1 where room_id=v_room.id;
  if (select count(*) from public.game_players where room_id=v_room.id and status='ready')=2 then
    update public.game_rooms set status='finished',updated_at=now() where id=v_room.id;
  end if;
  return public.super_strike_room_payload(v_room.id);
end $$;

revoke all on function public.super_strike_room_payload(uuid) from public,anon,authenticated;
revoke all on function public.create_super_strike_room() from public,anon;
revoke all on function public.join_super_strike_room(text) from public,anon;
revoke all on function public.get_super_strike_room(text) from public,anon;
revoke all on function public.update_super_strike_room(text,integer,integer,boolean) from public,anon;
grant execute on function public.create_super_strike_room() to authenticated;
grant execute on function public.join_super_strike_room(text) to authenticated;
grant execute on function public.get_super_strike_room(text) to authenticated;
grant execute on function public.update_super_strike_room(text,integer,integer,boolean) to authenticated;
