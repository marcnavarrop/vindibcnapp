-- VindiBCN · 0031
-- Enquestes de la comunitat (polls), opcions i respostes identificades.

-- ─── polls ──────────────────────────────────────────────────────────────────
create table public.polls (
  id            uuid        primary key default gen_random_uuid(),
  question      text        not null,
  allow_multiple boolean    not null default false,
  active        boolean     not null default true,
  created_by    uuid        references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  closes_at     date        null
);

-- ─── poll_options ────────────────────────────────────────────────────────────
create table public.poll_options (
  id         uuid    primary key default gen_random_uuid(),
  poll_id    uuid    not null references public.polls(id) on delete cascade,
  label      text    not null,
  sort_order integer not null default 0
);

-- ─── poll_responses ──────────────────────────────────────────────────────────
-- unique(poll_id, client_id, option_id) evita votar la mateixa opció dues vegades.
-- Per a enquestes d'opció única, l'aplicació rebutja inserts si ja existeix
-- algun vot del client per al poll_id.
create table public.poll_responses (
  id           uuid        primary key default gen_random_uuid(),
  poll_id      uuid        not null references public.polls(id) on delete cascade,
  option_id    uuid        not null references public.poll_options(id) on delete cascade,
  client_id    uuid        not null references public.clients(id) on delete cascade,
  responded_at timestamptz not null default now(),
  unique (poll_id, client_id, option_id)
);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
alter table public.polls          enable row level security;
alter table public.poll_options   enable row level security;
alter table public.poll_responses enable row level security;

-- polls: qualsevol autenticat pot llegir
create policy "polls_select"
  on public.polls for select
  using (auth.role() = 'authenticated');

-- polls: only admin pot escriure
create policy "polls_insert"  on public.polls for insert  with check (public.is_admin());
create policy "polls_update"  on public.polls for update  using     (public.is_admin());
create policy "polls_delete"  on public.polls for delete  using     (public.is_admin());

-- poll_options: qualsevol autenticat pot llegir
create policy "poll_options_select"
  on public.poll_options for select
  using (auth.role() = 'authenticated');

create policy "poll_options_insert" on public.poll_options for insert with check (public.is_admin());
create policy "poll_options_update" on public.poll_options for update using     (public.is_admin());
create policy "poll_options_delete" on public.poll_options for delete using     (public.is_admin());

-- poll_responses: admin veu totes; client veu les seves
create policy "poll_responses_select"
  on public.poll_responses for select
  using (
    public.is_admin()
    or public.owns_client(client_id)
  );

-- poll_responses: el client pot insertar les seves pròpies
create policy "poll_responses_insert"
  on public.poll_responses for insert
  with check (public.owns_client(client_id));

-- poll_responses: admin pot esborrar (gestió)
create policy "poll_responses_delete"
  on public.poll_responses for delete
  using (public.is_admin());

-- ─── índexs ──────────────────────────────────────────────────────────────────
create index poll_options_poll_idx     on public.poll_options   (poll_id, sort_order);
create index poll_responses_poll_idx   on public.poll_responses (poll_id);
create index poll_responses_client_idx on public.poll_responses (client_id);
