-- ============================================================================
-- VindiBCN · 0080 — El lloc on anomenar els centres, i res més
--
-- Fase 1 —i de moment l'única— del futur suport multi-centre: un registre de
-- NOMS. L'app segueix operant com un sol centre, exactament igual que ahir.
--
-- AQUESTA TAULA NO LA LLEGEIX NINGÚ, I ÉS A POSTA
--
-- Neix òrfena. Cap client, professional, servei, reserva ni bo hi apunta, i cap
-- pantalla que no sigui /admin/centres la consulta. Repartir dades operatives
-- entre centres és una feina gran, amb el seu propi disseny, i barrejar-la amb
-- això hauria fet que aquesta migració decidís coses que encara no toca
-- decidir. Aquí només es deixa preparat el lloc on escriure els noms.
--
-- Si has arribat aquí perquè vols enganxar-hi alguna cosa: aquell és el moment
-- de la fase de repartiment, no d'afegir una columna de passada.
--
-- PER QUÈ ES DIU `centers` I NO UNA ALTRA COSA
--
-- Perquè "centre" és la paraula d'aquesta casa: ho són `center_settings`,
-- `CENTER_NAME`, `CENTER_EMAIL`, `CENTER_TZ` i tot el que el client llegeix a
-- la pantalla. Inventar-ne un sinònim ara —`locations`, `branches`— hauria
-- deixat el projecte amb dos vocabularis per a la mateixa cosa real, que és una
-- confusió pitjor i més duradora que la que estalvia.
--
-- ATENCIÓ, PERÒ, A LA CONFUSIÓ QUE SÍ QUE HI HA
--
-- `center_settings` NO és "la configuració dels centres". És un SINGLETON: la
-- 0024 li va posar `id boolean primary key default true` amb un
-- `check (id)` que força que només hi hagi una fila mai. Guarda la política de
-- cancel·lació, els horaris i la resta d'ajustos, i és GLOBAL.
--
-- Les dues taules no es toquen ni es referencien. Qui les trobi juntes que no
-- doni per fet que `center_settings` penja de `centers`: no ho fa, i decidir si
-- algun dia els ajustos passen a ser per centre o es queden globals és
-- precisament una de les preguntes de la fase de repartiment.
--
-- NO HI HA POLÍTICA D'ESBORRAT, TAMPOC PER CASUALITAT
--
-- El patró de la casa (0038, 0068) porta les quatre: select, insert, update i
-- delete. Aquí la de delete no hi és perquè la pantalla no esborra. Un centre
-- és una cosa que existeix al món; si algú n'escriu un malament, el reanomena.
-- I el dia que hi hagi dades penjant-hi, esborrar-lo serà qualsevol cosa menys
-- un `delete` d'una fila. Afegir la política és una sentència; treure-la
-- després d'haver perdut alguna cosa, no.
-- ============================================================================

create table if not exists public.centers (
  id         uuid primary key default gen_random_uuid(),
  -- Mateixos límits que el catàleg d'etiquetes de la 0068: el `check` viu a la
  -- base perquè no depengui que el formulari el recordi.
  name       text not null check (length(trim(name)) between 1 and 80),
  created_at timestamptz not null default now()
);

comment on table public.centers is
  'Registre de noms de centres (0080). Fase 1 del multi-centre: deliberadament òrfena, no la referencia ningú. No confondre amb center_settings, que és un singleton global d''ajustos.';

-- Sense distingir majúscules ni espais als extrems, com a la 0068: "Vindi" i
-- " vindi " són el mateix centre. Evita el registre brut de teclejar a mà.
create unique index if not exists centers_name_uidx
  on public.centers (lower(trim(name)));

-- ─── Llavor: el centre que ja existeix al món ───────────────────────────────
--
-- El nom surt de `CENTER_NAME` (lib/notifications/brand.ts), que és l'únic lloc
-- del projecte que anomena el centre i el que ja va signat a tots els correus i
-- als PDF dels vals: "VindiBCN", en una sola paraula.
--
-- Idempotent: el `where not exists` fa servir el mateix criteri que l'índex
-- únic, així que tornar a passar la migració no crea un duplicat ni peta.
insert into public.centers (name)
select 'VindiBCN'
where not exists (
  select 1 from public.centers where lower(trim(name)) = 'vindibcn'
);

-- ─── RLS: només admin, també en lectura ────────────────────────────────────
--
-- Mateix patró que `service_rates` (0038). En lectura també, encara que un nom
-- de centre no sigui cap secret: mentre no el necessiti ningú més, la porta
-- estreta és la que no cal recordar-se de tancar després.

alter table public.centers enable row level security;

drop policy if exists "centers_select" on public.centers;
create policy "centers_select"
  on public.centers for select
  to authenticated
  using (public.is_admin());

drop policy if exists "centers_insert" on public.centers;
create policy "centers_insert"
  on public.centers for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "centers_update" on public.centers;
create policy "centers_update"
  on public.centers for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- (Sense policy de delete: vegeu la capçalera.)
