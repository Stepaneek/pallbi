create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null,
  event_type text not null,
  title text not null,
  start_date date not null,
  end_date date not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table public.events enable row level security;

create index if not exists events_athlete_id_idx on public.events (athlete_id);
create index if not exists events_date_range_idx on public.events (start_date, end_date);

drop policy if exists "Athlete views own events" on public.events;
drop policy if exists "Athlete inserts own events" on public.events;
drop policy if exists "Athlete updates own events" on public.events;
drop policy if exists "Athlete deletes own events" on public.events;

create policy "Athlete views own events"
on public.events
for select
to authenticated
using (
  auth.uid() = athlete_id
  or public.is_linked_coach(auth.uid(), athlete_id)
);

create policy "Athlete inserts own events"
on public.events
for insert
to authenticated
with check (auth.uid() = athlete_id);

create policy "Athlete updates own events"
on public.events
for update
to authenticated
using (auth.uid() = athlete_id)
with check (auth.uid() = athlete_id);

create policy "Athlete deletes own events"
on public.events
for delete
to authenticated
using (auth.uid() = athlete_id);

create trigger update_events_updated_at
before update on public.events
for each row
execute function public.update_updated_at_column();

drop table if exists public.calendar_events;

select public.reload_public_schema_cache();