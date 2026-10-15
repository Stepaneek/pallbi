alter table public.calendar_events enable row level security;

drop policy if exists "Athlete views own events" on public.calendar_events;
drop policy if exists "Athlete inserts own events" on public.calendar_events;
drop policy if exists "Athlete updates own events" on public.calendar_events;
drop policy if exists "Athlete deletes own events" on public.calendar_events;

create policy "Athlete views own events"
on public.calendar_events
for select
to authenticated
using (
  auth.uid() = athlete_id
  or public.is_linked_coach(auth.uid(), athlete_id)
);

create policy "Athlete inserts own events"
on public.calendar_events
for insert
to authenticated
with check (auth.uid() = athlete_id);

create policy "Athlete updates own events"
on public.calendar_events
for update
to authenticated
using (auth.uid() = athlete_id)
with check (auth.uid() = athlete_id);

create policy "Athlete deletes own events"
on public.calendar_events
for delete
to authenticated
using (auth.uid() = athlete_id);

select public.reload_public_schema_cache();