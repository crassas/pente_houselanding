-- Pentehouse online booking MVP
-- Additive migration: reuses clients, appointments, payments, services and barbers.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

drop trigger if exists trg_push_subscriptions_updated on public.push_subscriptions;
create trigger trg_push_subscriptions_updated
before update on public.push_subscriptions
for each row execute function public.set_updated_at();

alter table public.push_subscriptions enable row level security;

drop policy if exists "own push subscriptions" on public.push_subscriptions;
create policy "own push subscriptions"
on public.push_subscriptions
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant all on public.push_subscriptions to service_role;

create or replace function public.online_service_name(p_key text)
returns text
language sql
immutable
set search_path = public
as $$
  select case lower(btrim(coalesce(p_key, '')))
    when 'cabelo' then 'Cabelo'
    when 'cabelo-e-barba' then 'Cabelo e Barba'
    when 'corte-crianca' then 'Corte Criança'
    when 'barba' then 'Barba'
    when 'pera-e-bigode' then 'Pêra e Bigode'
    when 'sobrancelhas' then 'Sobrancelhas'
    when 'relaxamento-capilar' then 'Relaxamento Capilar'
    when 'contornos' then 'Contornos'
    else null
  end
$$;

create or replace function public.online_booking_availability(
  p_service_key text,
  p_days integer default 7,
  p_limit integer default 8
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_service public.services;
  v_service_name text;
  v_days integer := greatest(1, least(coalesce(p_days, 7), 14));
  v_limit integer := greatest(1, least(coalesce(p_limit, 8), 50));
  v_today date := (now() at time zone 'Europe/Lisbon')::date;
  v_now_time time := (now() at time zone 'Europe/Lisbon')::time;
  v_date date;
  v_dow integer;
  v_shop_open time;
  v_shop_close time;
  v_last_booking time;
  v_closed boolean;
  v_special public.special_hours;
  v_has_special boolean;
  v_barber record;
  v_schedule record;
  v_time time;
  v_end time;
  v_window_start time;
  v_window_end time;
  v_start_ts timestamptz;
  v_end_ts timestamptz;
  v_count integer := 0;
  v_slots jsonb := '[]'::jsonb;
begin
  v_service_name := public.online_service_name(p_service_key);
  if v_service_name is null then
    raise exception 'Serviço inválido' using errcode = 'P0001';
  end if;

  select * into v_service
  from public.services
  where active and lower(name) = lower(v_service_name)
  limit 1;

  if not found then
    raise exception 'Serviço indisponível' using errcode = 'P0001';
  end if;

  for v_date in
    select d::date
    from generate_series(v_today, v_today + (v_days - 1), interval '1 day') d
  loop
    v_dow := extract(isodow from v_date)::int;
    v_shop_open := null;
    v_shop_close := null;
    v_last_booking := null;
    v_closed := true;

    select bh.open_time, bh.close_time, bh.last_booking_time, bh.closed
      into v_shop_open, v_shop_close, v_last_booking, v_closed
    from public.business_hours bh
    where bh.weekday = v_dow;

    select exists(select 1 from public.special_hours sh where sh.date = v_date)
      into v_has_special;

    if v_has_special then
      select * into v_special
      from public.special_hours sh
      where sh.date = v_date
      limit 1;

      if v_special.closed then
        continue;
      end if;

      v_closed := false;
      v_shop_open := coalesce(v_special.open_time, v_shop_open);
      v_shop_close := coalesce(v_special.close_time, v_shop_close);
      v_last_booking := coalesce(v_last_booking, v_shop_close);
    end if;

    if coalesce(v_closed, true) or v_shop_open is null or v_shop_close is null then
      continue;
    end if;

    for v_barber in
      select
        b.id,
        b.name,
        b.slug,
        b.sort_order,
        coalesce(bs.duration_override_minutes, v_service.duration_minutes) as duration_minutes
      from public.barbers b
      join public.barber_services bs
        on bs.barber_id = b.id
       and bs.service_id = v_service.id
       and bs.active
      where b.active
      order by b.sort_order, b.name
    loop
      for v_schedule in
        select s.start_time, s.end_time
        from public.schedules s
        where s.barber_id = v_barber.id
          and s.weekday = v_dow
          and s.active
        order by s.start_time
      loop
        v_window_start := greatest(v_schedule.start_time, v_shop_open);
        v_window_end := least(v_schedule.end_time, v_shop_close);

        v_time := v_window_start;
        while v_time < v_window_end loop
          v_end := (v_time + make_interval(mins => v_barber.duration_minutes))::time;

          exit when v_end > v_window_end;
          exit when v_last_booking is not null and v_time > v_last_booking;

          if not (v_date = v_today and v_time <= v_now_time) then
            v_start_ts := (v_date + v_time) at time zone 'Europe/Lisbon';
            v_end_ts := (v_date + v_end) at time zone 'Europe/Lisbon';

            if not exists (
              select 1
              from public.schedule_blocks sb
              where sb.barber_id = v_barber.id
                and tstzrange(sb.start_datetime, sb.end_datetime, '[)')
                    && tstzrange(v_start_ts, v_end_ts, '[)')
            )
            and not exists (
              select 1
              from public.appointments a
              where a.barber_id = v_barber.id
                and a.status not in ('cancelled','no_show')
                and a.slot && tsrange(v_date + v_time, v_date + v_end, '[)')
            ) then
              v_slots := v_slots || jsonb_build_array(
                jsonb_build_object(
                  'date', to_char(v_date, 'YYYY-MM-DD'),
                  'time', to_char(v_time, 'HH24:MI'),
                  'barberId', v_barber.slug,
                  'barberName', v_barber.name
                )
              );
              v_count := v_count + 1;

              if v_count >= v_limit then
                return jsonb_build_object(
                  'serviceId', p_service_key,
                  'serviceName', v_service.name,
                  'generatedAt', now(),
                  'slots', v_slots
                );
              end if;
            end if;
          end if;

          v_time := (v_time + interval '15 minutes')::time;
        end loop;
      end loop;
    end loop;
  end loop;

  return jsonb_build_object(
    'serviceId', p_service_key,
    'serviceName', v_service.name,
    'generatedAt', now(),
    'slots', v_slots
  );
end
$$;

create or replace function public.create_online_booking(
  p_name text,
  p_phone text,
  p_service_key text,
  p_barber text,
  p_date date,
  p_time time
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store constant uuid := '00000000-0000-0000-0000-000000000001';
  v_service public.services;
  v_service_name text;
  v_phone text;
  v_client_id uuid;
  v_barber record;
  v_duration integer;
  v_price numeric(10,2);
  v_end time;
  v_dow integer;
  v_shop_open time;
  v_shop_close time;
  v_last_booking time;
  v_closed boolean;
  v_special public.special_hours;
  v_has_special boolean;
  v_start_ts timestamptz;
  v_end_ts timestamptz;
  v_appointment_id uuid;
  v_deposit numeric(10,2);
  v_preference text := lower(btrim(coalesce(p_barber, '')));
begin
  if p_name is null or char_length(btrim(p_name)) < 1 or char_length(btrim(p_name)) > 120 then
    raise exception 'Nome inválido' using errcode = 'P0001';
  end if;

  v_phone := public.normalize_phone(p_phone);
  if v_phone is null or v_phone !~ '^9[1236][0-9]{7}$' then
    raise exception 'Telemóvel inválido' using errcode = 'P0001';
  end if;

  if p_date is null or p_time is null then
    raise exception 'Data e hora são obrigatórias' using errcode = 'P0001';
  end if;

  if p_date < (now() at time zone 'Europe/Lisbon')::date
     or p_date > (now() at time zone 'Europe/Lisbon')::date + 180 then
    raise exception 'Data inválida' using errcode = 'P0001';
  end if;

  if p_date = (now() at time zone 'Europe/Lisbon')::date
     and p_time <= (now() at time zone 'Europe/Lisbon')::time then
    raise exception 'Hora inválida' using errcode = 'P0001';
  end if;

  v_service_name := public.online_service_name(p_service_key);
  if v_service_name is null then
    raise exception 'Serviço inválido' using errcode = 'P0001';
  end if;

  select * into v_service
  from public.services
  where active and lower(name) = lower(v_service_name)
  limit 1;

  if not found then
    raise exception 'Serviço indisponível' using errcode = 'P0001';
  end if;

  v_dow := extract(isodow from p_date)::int;

  select bh.open_time, bh.close_time, bh.last_booking_time, bh.closed
    into v_shop_open, v_shop_close, v_last_booking, v_closed
  from public.business_hours bh
  where bh.weekday = v_dow;

  select exists(select 1 from public.special_hours sh where sh.date = p_date)
    into v_has_special;

  if v_has_special then
    select * into v_special
    from public.special_hours sh
    where sh.date = p_date
    limit 1;

    if v_special.closed then
      raise exception 'A barbearia está fechada neste dia' using errcode = 'P0001';
    end if;

    v_closed := false;
    v_shop_open := coalesce(v_special.open_time, v_shop_open);
    v_shop_close := coalesce(v_special.close_time, v_shop_close);
    v_last_booking := coalesce(v_last_booking, v_shop_close);
  end if;

  if coalesce(v_closed, true) or v_shop_open is null or v_shop_close is null then
    raise exception 'A barbearia está fechada neste dia' using errcode = 'P0001';
  end if;

  for v_barber in
    select
      b.id,
      b.name,
      b.slug,
      b.sort_order,
      coalesce(bs.duration_override_minutes, v_service.duration_minutes) as duration_minutes,
      coalesce(bs.price_override, v_service.price)::numeric(10,2) as service_price
    from public.barbers b
    join public.barber_services bs
      on bs.barber_id = b.id
     and bs.service_id = v_service.id
     and bs.active
    where b.active
      and (
        v_preference in ('', 'any', 'qualquer', 'qualquer barbeiro', 'qualquer barbeiro disponível')
        or lower(b.slug) = v_preference
        or lower(b.name) = v_preference
        or lower(b.name) like '%' || v_preference || '%'
      )
    order by b.sort_order, b.name
  loop
    v_duration := v_barber.duration_minutes;
    v_price := v_barber.service_price;
    v_end := (p_time + make_interval(mins => v_duration))::time;

    if p_time < v_shop_open or v_end > v_shop_close
       or (v_last_booking is not null and p_time > v_last_booking) then
      continue;
    end if;

    if not exists (
      select 1
      from public.schedules s
      where s.barber_id = v_barber.id
        and s.active
        and s.weekday = v_dow
        and s.start_time <= p_time
        and s.end_time >= v_end
    ) then
      continue;
    end if;

    v_start_ts := (p_date + p_time) at time zone 'Europe/Lisbon';
    v_end_ts := (p_date + v_end) at time zone 'Europe/Lisbon';

    if exists (
      select 1
      from public.schedule_blocks sb
      where sb.barber_id = v_barber.id
        and tstzrange(sb.start_datetime, sb.end_datetime, '[)')
            && tstzrange(v_start_ts, v_end_ts, '[)')
    ) then
      continue;
    end if;

    insert into public.clients (store_id, name, phone, created_by)
    values (v_store, btrim(p_name), v_phone, null)
    on conflict (store_id, normalized_phone) where normalized_phone is not null
    do nothing
    returning id into v_client_id;

    if v_client_id is null then
      select c.id into v_client_id
      from public.clients c
      where c.store_id = v_store
        and c.normalized_phone = v_phone
      limit 1;
    end if;

    begin
      insert into public.appointments (
        store_id,
        client_id,
        barber_id,
        service_id,
        appointment_date,
        start_time,
        end_time,
        status,
        price,
        payment_status,
        source,
        created_by
      ) values (
        v_store,
        v_client_id,
        v_barber.id,
        v_service.id,
        p_date,
        p_time,
        v_end,
        'pending',
        v_price,
        'unpaid',
        'online',
        null
      )
      returning id into v_appointment_id;
    exception
      when exclusion_violation then
        v_appointment_id := null;
    end;

    if v_appointment_id is not null then
      v_deposit := round(v_price * 0.50, 2);

      insert into public.audit_events (actor_user_id, action, entity, entity_id, data)
      values (
        null,
        'online_booking.create',
        'appointment',
        v_appointment_id,
        jsonb_build_object('source', 'online', 'deposit_required', v_deposit)
      );

      return jsonb_build_object(
        'bookingId', v_appointment_id,
        'status', 'pending_deposit',
        'serviceName', v_service.name,
        'barberName', v_barber.name,
        'date', to_char(p_date, 'YYYY-MM-DD'),
        'time', to_char(p_time, 'HH24:MI'),
        'price', v_price,
        'depositAmount', v_deposit,
        'paymentStatus', 'unpaid'
      );
    end if;

    if v_preference not in ('', 'any', 'qualquer', 'qualquer barbeiro', 'qualquer barbeiro disponível') then
      exit;
    end if;
  end loop;

  raise exception 'A vaga já não está disponível' using errcode = 'P0001';
end
$$;

create or replace function public.confirm_online_deposit(
  p_appointment_id uuid,
  p_reference text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_a public.appointments;
  v_expected numeric(10,2);
  v_existing numeric(10,2);
  v_payment_id uuid;
begin
  if not public.is_staff() then
    raise exception 'Sem permissão' using errcode = 'P0001';
  end if;

  select * into v_a
  from public.appointments
  where id = p_appointment_id
  for update;

  if not found then
    raise exception 'Marcação não encontrada' using errcode = 'P0001';
  end if;

  if v_a.source <> 'online' then
    raise exception 'Esta marcação não é uma reserva online' using errcode = 'P0001';
  end if;

  if not (public.is_admin() or v_a.barber_id = public.current_barber_id()) then
    raise exception 'Sem permissão para esta marcação' using errcode = 'P0001';
  end if;

  if v_a.status in ('cancelled','no_show') then
    raise exception 'A marcação não pode ser confirmada' using errcode = 'P0001';
  end if;

  v_expected := round(v_a.price * 0.50, 2);

  select coalesce(sum(p.amount) filter (where p.status = 'completed'), 0)
    into v_existing
  from public.payments p
  where p.appointment_id = v_a.id;

  if v_existing < v_expected then
    insert into public.payments (
      appointment_id,
      client_id,
      amount,
      method,
      status,
      reference,
      created_by
    ) values (
      v_a.id,
      v_a.client_id,
      v_expected - v_existing,
      'mbway',
      'completed',
      nullif(btrim(p_reference), ''),
      auth.uid()
    )
    returning id into v_payment_id;
  end if;

  update public.appointments
  set status = 'confirmed'
  where id = v_a.id
    and status in ('pending','confirmed');

  insert into public.audit_events (actor_user_id, action, entity, entity_id, data)
  values (
    auth.uid(),
    'online_booking.deposit_confirmed',
    'appointment',
    v_a.id,
    jsonb_build_object('expected_deposit', v_expected, 'payment_id', v_payment_id)
  );

  return jsonb_build_object(
    'appointmentId', v_a.id,
    'status', 'confirmed',
    'depositAmount', v_expected,
    'paymentStatus', (select payment_status from public.appointments where id = v_a.id)
  );
end
$$;

revoke all on function public.online_service_name(text) from public;
revoke all on function public.online_booking_availability(text, integer, integer) from public;
revoke all on function public.create_online_booking(text, text, text, text, date, time) from public;
revoke all on function public.confirm_online_deposit(uuid, text) from public;

grant execute on function public.online_booking_availability(text, integer, integer) to anon, authenticated, service_role;
grant execute on function public.create_online_booking(text, text, text, text, date, time) to anon, authenticated, service_role;
grant execute on function public.confirm_online_deposit(uuid, text) to authenticated, service_role;
