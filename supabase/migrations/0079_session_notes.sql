-- ============================================================================
-- VindiBCN · 0079 — La nota d'una sessió, que només llegeixen tres persones
--
-- Qui va donar UNA sessió concreta hi pot deixar una nota de seguiment. La
-- llegeixen ell mateix, el client i l'administració. CAP ALTRE PROFESSIONAL,
-- ni tan sols el que coordina aquell mateix client.
--
-- PER QUÈ NO ÉS UNA COLUMNA A `reservations`
--
-- Perquè no pot ser-ho. La política viva de la 0005 acaba així:
--
--   or public.is_trainer()      -- qualsevol professional veu TOTES les reserves
--
-- Es va afegir per a la coordinació i l'agenda del centre hi descansa
-- ("Veus l'agenda completa del centre; només pots gestionar les dels teus
-- clients"). Una nota desada en aquella fila la llegiria tothom. La RLS és per
-- FILA, no per columna: ja ho diu la 0035 sobre aquest mateix problema —"les
-- polítiques de `clients` són a nivell de fila, no de columna"—. I els GRANT
-- per columna de Postgres tampoc hi arriben: són per ROL, no per titular de
-- fila, i no saben dir "aquest professional sí i aquell no".
--
-- Estrènyer `reservations_select` per encabir-hi la nota trencaria l'agenda
-- sencera. Per això la nota viu a part, amb la seva pròpia porta.
--
-- EL PREDICAT ÉS NOU, NO N'HI HAVIA CAP D'IGUAL
--
-- `reservations_trainer_write` fa servir `is_trainer_of(client_id)`: el
-- professional ASSIGNAT AL CLIENT. Això és el patró compartit, el mateix de
-- `clients.clinical_notes`, i és justament el que aquí NO volem. Cal
-- `is_session_trainer(reservation_id)`: el de AQUELLA reserva.
--
-- QUÈ PASSA SI ES REASSIGNA LA RESERVA
--
-- El predicat es mira EN VIU, així que si l'administració canvia el
-- `trainer_id` d'una sessió, l'accés (lectura i escriptura) passa al nou. És
-- deliberat: la nota és de la SESSIÓ, i qui la té assignada és qui se'n fa
-- responsable. L'alternativa —lligar-la a l'autor— deixa notes òrfenes que
-- ningú pot corregir el dia que algú plega.
--
-- Per això `author_id` no és decoratiu: la nota SEMPRE ensenya qui la va
-- escriure de debò, encara que ara la governi un altre. Sense això, una
-- reassignació faria semblar del nou una nota que no és seva.
--
-- L'ADMINISTRACIÓ NOMÉS LLEGEIX
--
-- Desviació deliberada del patró de la casa (`*_admin_write for all`), decidida
-- a consciència: això és un registre professional signat per qui va donar la
-- sessió. Que un tercer l'editi trencaria precisament allò que el fa valer.
-- Si algun dia cal, afegir la política és una línia; treure-la, un problema.
--
-- NO ÉS UNA NOTA CLÍNICA
--
-- És seguiment de la sessió, i el client la llegeix. El que sigui informació de
-- salut segueix a `clients.clinical_notes`, que la 0035 va separar precisament
-- perquè demana el seu propi consentiment i NO la veu el client. El formulari
-- ho diu amb totes les lletres a qui escriu.
-- ============================================================================

create table if not exists public.session_notes (
  -- Una nota per sessió: la clau primària és la reserva mateixa. "La nota
  -- d'aquella sessió" és singular, i així ho és també a la base.
  reservation_id uuid primary key references public.reservations (id) on delete cascade,
  -- Qui la va escriure. Pot quedar NULL: si el professional es dona de baixa
  -- (`gdpr-delete`), la nota sobreviu i perd la signatura. Al revés —esborrar
  -- la nota del client perquè plega qui la va escriure— seria pitjor.
  author_id      uuid references public.profiles (id) on delete set null,
  -- Text lliure. El `check` barra la nota buida: si no hi ha res a dir, no hi
  -- ha d'haver fila.
  body           text not null check (length(btrim(body)) > 0),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.session_notes is
  'Nota de seguiment d''una sessió. La escriu el professional d''AQUELLA reserva; la llegeixen ell, el client i l''administració (0079).';
comment on column public.session_notes.author_id is
  'Qui la va escriure de debò. Es mostra sempre: si la reserva es reassigna, la governa un altre però la signatura no canvia.';

-- Per llistar les notes d'un client d'un sol cop, unint per la reserva.
create index if not exists session_notes_author_idx
  on public.session_notes (author_id);

-- ---------------------------------------------------------------------------
-- Helpers. SECURITY DEFINER i `search_path` fixat, com els de la 0001.
-- ---------------------------------------------------------------------------

-- El professional d'AQUESTA reserva. No confondre amb `is_trainer_of`, que és
-- el del CLIENT: aquella és la porta ampla i aquesta la estreta.
create or replace function public.is_session_trainer(rid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.reservations r
    where r.id = rid and r.trainer_id = auth.uid()
  )
$$;

-- El client d'AQUESTA reserva.
create or replace function public.owns_reservation(rid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.reservations r
    join public.clients c on c.id = r.client_id
    where r.id = rid and c.profile_id = auth.uid()
  )
$$;

comment on function public.is_session_trainer is
  'El professional assignat a AQUESTA reserva (no el del client): la porta estreta de session_notes (0079).';

-- El `revoke` va davant del `grant`, com a la 0061/0065.
revoke execute on function public.is_session_trainer(uuid) from public;
revoke execute on function public.is_session_trainer(uuid) from anon;
grant  execute on function public.is_session_trainer(uuid) to authenticated;

revoke execute on function public.owns_reservation(uuid) from public;
revoke execute on function public.owns_reservation(uuid) from anon;
grant  execute on function public.owns_reservation(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.session_notes enable row level security;

-- LECTURA: l'administració, el professional d'aquella sessió i el seu client.
-- Fixa't en el que NO hi ha: `or public.is_trainer()`. Aquella línia és la que
-- fa que qualsevol professional vegi totes les reserves, i aquí seria el
-- forat sencer. Si algun dia algú l'hi afegeix "per coherència", que sàpiga
-- que està desfent l'única cosa que aquesta taula existeix per fer.
create policy "session_notes_select" on public.session_notes
  for select using (
    public.is_admin()
    or public.is_session_trainer(reservation_id)
    or public.owns_reservation(reservation_id)
  );

-- ESCRIPTURA: només el professional d'aquella sessió, i signant amb el seu nom.
-- El `with check` porta les DUES condicions a posta: sense `author_id =
-- auth.uid()` es podria desar una nota firmada per un altre.
create policy "session_notes_trainer_write" on public.session_notes
  for all
  using (public.is_session_trainer(reservation_id))
  with check (
    public.is_session_trainer(reservation_id)
    and author_id = auth.uid()
  );

-- El client NO té política d'escriptura: llegeix i prou. L'administració
-- tampoc, a posta (vegeu la capçalera).

-- ---------------------------------------------------------------------------
-- `updated_at` al dia, com als tiquets de suport (0047).
-- ---------------------------------------------------------------------------

create or replace function public.touch_session_note()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists session_notes_touch on public.session_notes;
create trigger session_notes_touch
  before update on public.session_notes
  for each row execute function public.touch_session_note();

revoke execute on function public.touch_session_note() from public;
revoke execute on function public.touch_session_note() from anon;
revoke execute on function public.touch_session_note() from authenticated;
