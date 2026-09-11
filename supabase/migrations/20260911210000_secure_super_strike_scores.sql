-- Server-verified and idempotent Super Strike scoring.

create table if not exists public.super_strike_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('solo', 'cpu')),
  status text not null default 'active' check (status in ('active', 'completed', 'abandoned')),
  frames jsonb,
  score integer check (score between 0 and 300),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.super_strike_runs enable row level security;
revoke all on table public.super_strike_runs from public, anon, authenticated;
grant all on table public.super_strike_runs to service_role;
create index if not exists super_strike_runs_user_status_idx
  on public.super_strike_runs (user_id, status, started_at desc);

create or replace function private.score_super_strike_frames(
  p_frames jsonb,
  p_require_complete boolean default true
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $function$
declare
  v_rolls integer[] := '{}'::integer[];
  v_starts integer[] := '{}'::integer[];
  v_frame jsonb;
  v_frame_rolls jsonb;
  v_i integer;
  v_j integer;
  v_n integer;
  v_a integer;
  v_b integer;
  v_c integer;
  v_total integer := 0;
  v_completed integer := 0;
  v_incomplete boolean := false;
  v_finished boolean := false;
  v_strikes integer := 0;
  v_spares integer := 0;
begin
  if jsonb_typeof(p_frames) <> 'array' or jsonb_array_length(p_frames) <> 10 then
    raise exception 'invalid_bowling_frames';
  end if;

  for v_i in 0..9 loop
    v_frame := p_frames -> v_i;
    v_frame_rolls := v_frame -> 'rolls';
    if jsonb_typeof(v_frame) <> 'object' or jsonb_typeof(v_frame_rolls) <> 'array' then
      raise exception 'invalid_bowling_frame';
    end if;
    v_n := jsonb_array_length(v_frame_rolls);
    v_starts := array_append(v_starts, coalesce(array_length(v_rolls, 1), 0) + 1);

    for v_j in 0..greatest(v_n - 1, -1) loop
      begin
        v_a := (v_frame_rolls ->> v_j)::integer;
      exception when others then
        raise exception 'invalid_bowling_roll';
      end;
      if v_a < 0 or v_a > 10 then raise exception 'invalid_bowling_roll'; end if;
      v_rolls := array_append(v_rolls, v_a);
    end loop;

    v_a := case when v_n > 0 then (v_frame_rolls ->> 0)::integer end;
    v_b := case when v_n > 1 then (v_frame_rolls ->> 1)::integer end;
    v_c := case when v_n > 2 then (v_frame_rolls ->> 2)::integer end;

    if v_incomplete and v_n > 0 then raise exception 'bowling_frames_out_of_order'; end if;

    if v_i < 9 then
      if v_n = 1 and v_a = 10 then
        v_completed := v_completed + 1;
        v_strikes := v_strikes + 1;
      elsif v_n = 2 and v_a < 10 and v_a + v_b <= 10 then
        v_completed := v_completed + 1;
        if v_a + v_b = 10 then v_spares := v_spares + 1; end if;
      elsif v_n = 0 or (v_n = 1 and v_a < 10) then
        v_incomplete := true;
      else
        raise exception 'invalid_bowling_frame';
      end if;
    else
      if v_n > 3 then raise exception 'invalid_tenth_frame'; end if;
      if v_n >= 2 and v_a < 10 and v_a + v_b > 10 then raise exception 'invalid_tenth_frame'; end if;
      if v_n = 3 then
        if v_a < 10 and v_a + v_b <> 10 then raise exception 'unexpected_bonus_roll'; end if;
        if v_a = 10 and v_b < 10 and v_b + v_c > 10 then raise exception 'invalid_bonus_rack'; end if;
      end if;
      if v_n >= 1 and v_a = 10 then v_strikes := v_strikes + 1; end if;
      if v_n >= 2 and v_a < 10 and v_a + v_b = 10 then v_spares := v_spares + 1; end if;
      v_finished := (v_n = 2 and v_a < 10 and v_a + v_b < 10)
        or (v_n = 3 and (v_a = 10 or v_a + v_b = 10));
      if v_finished then v_completed := 10; end if;
    end if;
  end loop;

  if p_require_complete and not v_finished then raise exception 'incomplete_bowling_game'; end if;

  for v_i in 1..9 loop
    v_a := v_rolls[v_starts[v_i]];
    if v_a is null then exit; end if;
    if v_a = 10 then
      if v_rolls[v_starts[v_i] + 1] is not null and v_rolls[v_starts[v_i] + 2] is not null then
        v_total := v_total + 10 + v_rolls[v_starts[v_i] + 1] + v_rolls[v_starts[v_i] + 2];
      end if;
    elsif v_rolls[v_starts[v_i] + 1] is not null then
      v_b := v_rolls[v_starts[v_i] + 1];
      if v_a + v_b = 10 then
        if v_rolls[v_starts[v_i] + 2] is not null then v_total := v_total + 10 + v_rolls[v_starts[v_i] + 2]; end if;
      else
        v_total := v_total + v_a + v_b;
      end if;
    end if;
  end loop;
  if v_completed = 10 then
    v_total := v_total + coalesce(v_rolls[v_starts[10]], 0)
      + coalesce(v_rolls[v_starts[10] + 1], 0)
      + coalesce(v_rolls[v_starts[10] + 2], 0);
  end if;

  return jsonb_build_object(
    'score', v_total, 'current_frame', v_completed, 'finished', v_finished,
    'strikes', v_strikes, 'spares', v_spares
  );
end;
$function$;

revoke all on function private.score_super_strike_frames(jsonb, boolean) from public, anon, authenticated;

create or replace function private.super_strike_frames_extend(p_old jsonb, p_new jsonb)
returns boolean language plpgsql immutable set search_path = '' as $function$
declare v_i integer; v_j integer; v_old jsonb; v_new jsonb;
begin
  if p_old is null then return true; end if;
  for v_i in 0..9 loop
    v_old := p_old -> v_i -> 'rolls'; v_new := p_new -> v_i -> 'rolls';
    if jsonb_array_length(v_new) < jsonb_array_length(v_old) then return false; end if;
    for v_j in 0..greatest(jsonb_array_length(v_old) - 1, -1) loop
      if v_old -> v_j <> v_new -> v_j then return false; end if;
    end loop;
  end loop;
  return true;
end;
$function$;

revoke all on function private.super_strike_frames_extend(jsonb, jsonb) from public, anon, authenticated;

create or replace function public.start_super_strike_run(p_mode text)
returns jsonb language plpgsql security definer set search_path = '' as $function$
declare v_user uuid := (select auth.uid()); v_mode text := lower(trim(p_mode)); v_id uuid;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if v_mode not in ('solo','cpu') then raise exception 'invalid_mode'; end if;
  update public.super_strike_runs set status='abandoned'
    where user_id=v_user and status='active' and started_at < now() - interval '6 hours';
  insert into public.super_strike_runs(user_id, mode) values(v_user, v_mode) returning id into v_id;
  return jsonb_build_object('run_id', v_id::text);
end;
$function$;

revoke all on function public.start_super_strike_run(text) from public, anon;
grant execute on function public.start_super_strike_run(text) to authenticated;

create or replace function public.submit_super_strike_run(p_run_id uuid, p_frames jsonb, p_metadata jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $function$
declare
  v_user uuid := (select auth.uid()); v_run public.super_strike_runs; v_result jsonb;
  v_award jsonb; v_balance integer; v_score integer; v_strikes integer; v_spares integer;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if pg_catalog.octet_length(coalesce(p_metadata, '{}'::jsonb)::text) > 1024 then raise exception 'metadata_too_large'; end if;
  select * into v_run from public.super_strike_runs where id=p_run_id and user_id=v_user for update;
  if v_run.id is null then raise exception 'invalid_run'; end if;
  if v_run.status='completed' then
    v_result := private.score_super_strike_frames(v_run.frames, true);
    select coalesce(cool_points, points, 0) into v_balance from public.profiles where id=v_user;
    return jsonb_build_object('ok',true,'score',v_run.score,'strikes',(v_result->>'strikes')::integer,
      'spares',(v_result->>'spares')::integer,'points_delta',0,'balance',coalesce(v_balance,0),'duplicate',true);
  end if;
  if v_run.status<>'active' then raise exception 'run_not_active'; end if;
  if now() < v_run.started_at + interval '20 seconds' then raise exception 'game_finished_too_quickly'; end if;
  if lower(coalesce(p_metadata->>'mode','')) <> v_run.mode then raise exception 'mode_mismatch'; end if;

  v_result := private.score_super_strike_frames(p_frames, true);
  v_score := (v_result->>'score')::integer; v_strikes := (v_result->>'strikes')::integer; v_spares := (v_result->>'spares')::integer;
  v_award := private.award_super_strike_points(v_user,3,'super_strike_complete',v_run.id::text,'Super Strike game complete');

  update public.super_strike_runs set status='completed', frames=p_frames,
    score=v_score, completed_at=now() where id=v_run.id;
  insert into public.game_scores(user_id,game_key,score,points_delta,metadata,created_at)
    values(v_user,'super_strike',v_score,coalesce((v_award->>'amount')::integer,0),
      coalesce(p_metadata,'{}'::jsonb) || jsonb_build_object('strikes',v_strikes,'spares',v_spares,'run_id',v_run.id,'verified',true),now());
  select coalesce(cool_points,points,0) into v_balance from public.profiles where id=v_user;
  return jsonb_build_object('ok',true,'score',v_score,'strikes',v_strikes,'spares',v_spares,
    'points_delta',coalesce((v_award->>'amount')::integer,0),'balance',coalesce(v_balance,0));
end;
$function$;

revoke all on function public.submit_super_strike_run(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.submit_super_strike_run(uuid, jsonb, jsonb) to authenticated;

create or replace function public.sync_super_strike_room(p_room_code text, p_frames jsonb, p_finished boolean)
returns jsonb language plpgsql security definer set search_path = '' as $function$
declare
  v_user uuid := (select auth.uid()); v_room public.game_rooms; v_state jsonb; v_old jsonb; v_result jsonb;
  v_score integer; v_frame integer; v_is_finished boolean; v_finished_now uuid; v_max integer; v_min integer; v_player record; v_reward integer; v_award jsonb;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  select * into v_room from public.game_rooms where room_code=upper(trim(p_room_code)) and game_type='super_strike' for update;
  if v_room.id is null or not exists(select 1 from public.game_players where room_id=v_room.id and user_id=v_user and status<>'left') then raise exception 'not_room_player'; end if;
  select state into v_state from public.game_state where room_id=v_room.id for update;
  v_old := v_state->'progress'->v_user::text->'frames';
  v_result := private.score_super_strike_frames(p_frames, coalesce(p_finished,false));
  if not private.super_strike_frames_extend(v_old,p_frames) then raise exception 'roll_history_regression'; end if;
  v_score := (v_result->>'score')::integer; v_frame := (v_result->>'current_frame')::integer; v_is_finished := (v_result->>'finished')::boolean;
  if coalesce(p_finished,false) <> v_is_finished then raise exception 'finished_state_mismatch'; end if;
  update public.game_players set score=v_score,status=case when v_is_finished then 'ready' else 'playing' end where room_id=v_room.id and user_id=v_user;
  v_state := jsonb_set(coalesce(v_state,'{}'::jsonb),array['progress',v_user::text],
    jsonb_build_object('current_frame',v_frame,'finished',v_is_finished,'frames',p_frames,'updated_at',now()),true);
  update public.game_state set state=v_state,updated_by=v_user,updated_at=now(),version=version+1 where room_id=v_room.id;

  if (select count(*) from public.game_players where room_id=v_room.id and status='ready')=2 then
    update public.game_rooms set status='finished',updated_at=now() where id=v_room.id and status<>'finished' returning id into v_finished_now;
    if v_finished_now is not null then
      select max(score),min(score) into v_max,v_min from public.game_players where room_id=v_room.id and status<>'left';
      for v_player in select gp.user_id,gp.score,gs.state->'progress'->gp.user_id::text->'frames' as frames
        from public.game_players gp join public.game_state gs on gs.room_id=gp.room_id where gp.room_id=v_room.id and gp.status<>'left'
      loop
        v_reward := case when v_max<>v_min and v_player.score=v_max then 8 else 5 end;
        v_award := private.award_super_strike_points(v_player.user_id,v_reward,'super_strike_multiplayer',v_room.id::text,
          case when v_reward=8 then 'Super Strike multiplayer win' else 'Super Strike multiplayer match' end);
        insert into public.game_scores(user_id,game_key,score,points_delta,metadata,created_at)
          values(v_player.user_id,'super_strike',v_player.score,coalesce((v_award->>'amount')::integer,0),
            jsonb_build_object('mode','multiplayer','room_id',v_room.id,'verified',true),now());
      end loop;
    end if;
  end if;
  return public.super_strike_room_payload(v_room.id);
end;
$function$;

revoke all on function public.sync_super_strike_room(text, jsonb, boolean) from public, anon;
grant execute on function public.sync_super_strike_room(text, jsonb, boolean) to authenticated;

revoke execute on function public.update_super_strike_room(text, integer, integer, boolean) from authenticated;

create or replace function public.get_super_strike_leaderboard(p_limit integer default 20)
returns table(user_id uuid, display_name text, score integer, metadata jsonb)
language sql stable security definer set search_path = '' as $function$
  select gs.user_id, coalesce(p.display_name,'HYPHSWORLD Bowler'), gs.score, coalesce(gs.metadata,'{}'::jsonb)
  from public.game_scores gs left join public.profiles p on p.id=gs.user_id
  where gs.game_key='super_strike'
  order by gs.score desc, gs.created_at asc
  limit least(greatest(coalesce(p_limit,20),1),50);
$function$;

revoke all on function public.get_super_strike_leaderboard(integer) from public;
grant execute on function public.get_super_strike_leaderboard(integer) to anon, authenticated;
