-- ============================================================================
-- VindiBCN · 0072 — Subscripció mensual als bons de grup
--
-- Qui ve una o dues vegades per setmana i no falla no hauria de comprar el bo
-- cada vegada. Aquesta migració posa l'esquema d'una subscripció mensual que
-- el renova sol.
--
-- LES QUATRE DECISIONS QUE L'ORDENEN TOT
--
-- 1. NOMÉS 'grupo_reducido'. No és una limitació tècnica sinó de producte, i
--    per això viu a la base com un check i no només al codi. El dia que el
--    centre en vulgui més, la migració que ho obri serà el lloc on quedi
--    escrit que s'ha decidit.
--
-- 2. RENOVACIÓ PER CALENDARI, no per consum. Cada client es renova el dia del
--    mes en què es va donar d'alta (`anchor_day`), no un dia fix per a tothom
--    ni quan se li acaben les sessions. És l'aniversari seu.
--
-- 3. LES SESSIONS NO S'ACUMULEN. El bo d'un cicle caduca quan comença el
--    següent. Sense això, qui fa 5 de 8 durant un any acaba amb trenta
--    sessions al banc i la subscripció deixa de ser una subscripció.
--    ATENCIÓ al que vol dir "fer servir": reservar, no assistir. Reservar ja
--    descompta, així que amb el bo d'aquest mes es poden agafar franges del mes
--    que ve. La vàlvula d'escapament hi és; el que caduca és el que no s'ha
--    arribat a reservar.
--
-- 4. EL PREU ES CONGELA A L'ALTA i no es torna a cotitzar mai. Una oferta
--    segmentada vigent el dia de l'alta queda dins per sempre; una que
--    aparegui després no hi entra. És el que espera qui es subscriu, i evita
--    que a algú li pugi el rebut automàtic perquè s'ha acabat una promoció.
--    Les recompenses de referit NO hi entren: són d'un sol ús i en una
--    subscripció es convertirien en un descompte perpetu. Segueixen
--    disponibles per a una compra solta.
--
-- QUÈ NO PORTA AQUESTA MIGRACIÓ, I PER QUÈ
--
-- Cap plaç de pagament nou. L'impagament ja té sistema (0044) i aquí es
-- reutilitza sencer: un bo de renovació sense cobrar és un 'pending_payment'
-- com qualsevol altre, i l'escombrat diari ja li allibera les franges i el posa
-- a 'unpaid'. El que decideix si la subscripció segueix viva no és cap
-- comptador nou sinó la pròpia data de renovació: si en arribar el dia el bo
-- del cicle anterior encara no s'ha cobrat, no es renova i la subscripció passa
-- a 'past_due'. El termini per pagar un mes de subscripció és, honestament, un
-- mes.
--
-- Això té una propietat que val la pena dir: DEGRADA BÉ. A producció
-- `pending_payment_cancel_enabled` està desactivat, o sigui que l'escombrat de
-- la 0044 ara mateix no corre. Tant se val: el fre de la renovació és
-- independent i no deixa acumular mesos impagats.
--
-- CAP DATA ES CALCULA AQUÍ. Les escriu l'aplicació amb `centerToday()`, com ja
-- passa amb `bonos.expires_at`. La zona del centre és configurable per variable
-- d'entorn (CENTER_TIMEZONE), així que un `now() at time zone 'Europe/Madrid'`
-- clavat al DDL seria una segona veritat que se n'aniria de la primera el dia
-- que algú canviï la variable.
-- ============================================================================

-- ─── Configuració del centre ────────────────────────────────────────────────
--
-- Apagat per defecte, mateix criteri que `pending_payment_cancel_enabled` de la
-- 0044: desplegar això no ha de canviar res del que el centre veu avui.

alter table public.center_settings
  add column if not exists subscriptions_enabled boolean not null default false,
  add column if not exists subscription_extra_sessions_max integer not null default 1
    check (subscription_extra_sessions_max between 0 and 10);

comment on column public.center_settings.subscriptions_enabled is
  'Es poden CONTRACTAR subscripcions noves. Apagar-ho no toca les vigents: continuen renovant-se. Mateix criteri que gift_vouchers_enabled.';
comment on column public.center_settings.subscription_extra_sessions_max is
  'Sessions extra que un subscriptor pot demanar dins d''un mateix cicle, al preu per sessió del seu bo base. 0 = cap.';

-- ─── Estat de la subscripció ────────────────────────────────────────────────
--
-- Tres i no quatre: 'past_due' ja vol dir "aturada fins que pagui", que és el
-- que la 0044 fa amb els bons. Un 'paused' a part seria el mateix estat amb dos
-- noms, i tard o d'hora dues pantalles en dirien coses diferents.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'subscription_status') then
    create type public.subscription_status as enum (
      'active',    -- es renova sola cada mes
      'past_due',  -- el cicle anterior no s'ha cobrat: no es renova fins que es pagui
      'cancelled'  -- no es renovarà més (el cicle ja pagat es conserva fins que caduca)
    );
  end if;
end
$$;

-- ─── La taula ───────────────────────────────────────────────────────────────

create table if not exists public.subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  client_id              uuid not null references public.clients (id) on delete cascade,
  service_id             uuid not null references public.services (id) on delete restrict,

  -- Fotografia del paquet i del preu, congelada a l'alta. Mateix criteri que
  -- `gift_vouchers`: el que s'ha venut s'ha de poder lliurar encara que demà el
  -- centre canviï la tarifa, les sessions del paquet o el nom. Amb només el
  -- `service_id`, renovar dependria que el catàleg segueixi igual dotze mesos.
  service_type           public.service_type not null,
  sessions_per_cycle     integer not null check (sessions_per_cycle > 0),
  package_name           text not null,
  unit_price             numeric(10,2) not null check (unit_price >= 0),

  payment_method         public.payment_method not null,
  status                 public.subscription_status not null default 'active',

  -- Dia del mes en què toca renovar. 29, 30 i 31 s'admeten i els mesos curts es
  -- resolen retallant al darrer dia, exactament com fan ja `expiryForNewBono` i
  -- `nextOccurrence`: mai se salta al mes següent.
  anchor_day             smallint not null check (anchor_day between 1 and 31),

  started_on             date not null,
  current_cycle_start    date not null,
  next_renewal_on        date,

  cancel_at_period_end   boolean not null default false,
  cancelled_at           timestamptz,

  -- Només quan es paga amb targeta. Stripe és el motor de cobrament; qui mana
  -- sobre el que el client té dret a fer és aquesta taula.
  stripe_customer_id     text,
  stripe_subscription_id text,

  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  -- Decisió de producte, escrita a la base perquè no es pugui colar per cap
  -- camí. Obrir-ho a més serveis és un `alter` d'una línia, i el dia que es
  -- faci quedarà dit en una migració en comptes de diluït en un `if` del codi.
  constraint subscriptions_only_group
    check (service_type = 'grupo_reducido'),

  -- Una subscripció de targeta SEMPRE neix del webhook de Stripe, i per tant
  -- amb el seu identificador ja posat. Una del centre no en té mai cap.
  constraint subscriptions_stripe_matches_method check (
    (payment_method = 'card' and stripe_subscription_id is not null)
    or (payment_method = 'cash' and stripe_subscription_id is null
        and stripe_customer_id is null)
  ),

  -- Una subscripció viva ha de saber quan li toca; una de cancel·lada, quan es
  -- va cancel·lar. Sense això, una 'cancelled' amb data de renovació seguiria
  -- sortint a l'escombrat i tornaria a cobrar.
  constraint subscriptions_renewal_matches_status check (
    (status = 'cancelled' and next_renewal_on is null and cancelled_at is not null)
    or (status <> 'cancelled' and next_renewal_on is not null)
  )
);

comment on table public.subscriptions is
  'Subscripció mensual a un bo de grup. Renova per calendari (aniversari del client), no per consum. Font de veritat del dret del client; Stripe només hi posa els diners quan es paga amb targeta.';
comment on column public.subscriptions.anchor_day is
  'Dia del mes de la renovació, fixat a l''alta. Els mesos que no tenen aquest dia es retallen al darrer, mai salten al següent.';
comment on column public.subscriptions.unit_price is
  'Preu del cicle, congelat a l''alta amb les ofertes segmentades vigents aquell dia. No es torna a cotitzar mai.';
comment on column public.subscriptions.current_cycle_start is
  'Primer dia del cicle en curs. Amb subscription_cycle_start dels bons, diu quin bo i quins extres són d''aquest mes.';
comment on column public.subscriptions.cancel_at_period_end is
  'El client ha cancel·lat però conserva el cicle que ja ha pagat. En arribar next_renewal_on passa a cancelled en comptes de renovar.';

-- Una persona no pot tenir dues subscripcions vives del mateix servei. És una
-- regla de negoci, però es posa aquí i no al codi perquè també tanca la cursa:
-- el doble clic al botó d'alta, i el webhook de Stripe arribant alhora que una
-- alta manual de l'admin.
create unique index if not exists subscriptions_one_live_per_client
  on public.subscriptions (client_id, service_type)
  where status <> 'cancelled';

-- Mateix criteri que la 0054 amb les sessions de Checkout: una subscripció de
-- Stripe és una i només una.
create unique index if not exists subscriptions_stripe_uidx
  on public.subscriptions (stripe_subscription_id)
  where stripe_subscription_id is not null;

-- La consulta del cron de renovació: qui li toca avui.
create index if not exists subscriptions_renewal_sweep
  on public.subscriptions (status, next_renewal_on)
  where next_renewal_on is not null;

create index if not exists subscriptions_client_idx
  on public.subscriptions (client_id, created_at desc);

-- ─── D'on ve un bo ──────────────────────────────────────────────────────────

alter table public.bonos
  add column if not exists subscription_id uuid
    references public.subscriptions (id) on delete set null,
  add column if not exists subscription_cycle_start date,
  add column if not exists is_subscription_extra boolean not null default false,
  add column if not exists stripe_invoice_id text;

comment on column public.bonos.subscription_id is
  'Subscripció que ha emès aquest bo. Null = compra normal.';
comment on column public.bonos.subscription_cycle_start is
  'De quin cicle de la subscripció és aquest bo. Amb is_subscription_extra distingeix el bo base del mes de les sessions extra.';
comment on column public.bonos.is_subscription_extra is
  'Sessió extra demanada dins del cicle, al preu per sessió del bo base. No és el bo del mes.';
comment on column public.bonos.stripe_invoice_id is
  'Factura de Stripe que ha pagat aquest cicle. Única: evita emetre dos bons si el webhook arriba dos cops.';

-- Les tres columnes viatgen juntes o no viatgen. Un bo amb subscripció i sense
-- cicle no es podria assignar a cap mes, i un "extra" sense subscripció no vol
-- dir res.
alter table public.bonos
  drop constraint if exists bonos_subscription_coherent;
alter table public.bonos
  add constraint bonos_subscription_coherent check (
    (subscription_id is null
     and subscription_cycle_start is null
     and is_subscription_extra = false)
    or (subscription_id is not null and subscription_cycle_start is not null)
  );

-- ─── Que no es pugui emetre dos cops el mateix mes ──────────────────────────
--
-- Els dos camins de renovació poden repetir-se, i cap dels dos ha de deixar el
-- client amb sessions dobles:
--
--   · Amb targeta, perquè Stripe avisa que lliura el mateix esdeveniment més
--     d'un cop. Mateix truc i mateix motiu que la 0054.
--   · Al centre, perquè el cron pot córrer dues vegades el mateix dia (o
--     reintentar-se) i entre el SELECT i l'INSERT no hi ha res.
--
-- Com sempre en aquest projecte: la garantia la dona la base, no la sort.

create unique index if not exists bonos_stripe_invoice_uidx
  on public.bonos (stripe_invoice_id)
  where stripe_invoice_id is not null;

create unique index if not exists bonos_subscription_cycle_uidx
  on public.bonos (subscription_id, subscription_cycle_start)
  where subscription_id is not null and is_subscription_extra = false;

-- Els extres del cicle i el bo base del cicle es consulten per aquest parell.
create index if not exists bonos_subscription_idx
  on public.bonos (subscription_id, subscription_cycle_start)
  where subscription_id is not null;

-- ─── RLS ────────────────────────────────────────────────────────────────────
--
-- El SELECT va calcat de `bonos` (0001 + 0005): el client veu la seva i
-- qualsevol professional les veu totes, que és el que fa falta per coordinar-se
-- l'agenda.
--
-- L'ESCRIPTURA, EN CANVI, ÉS NOMÉS DE L'ADMIN, i aquí sí que ens separem de
-- `bonos`, que des de la 0005 deixa escriure també l'entrenador/a del client.
-- Copiar-ho seria un mal calc: una fila d'aquestes és l'única cosa que lliga
-- una subscripció de Stripe amb el nostre client, i un DELETE (que un
-- `for all` inclou) deixaria Stripe cobrant cada mes sense que quedés rastre
-- de qui ni per què. Un bo esborrat és un disgust; això és un càrrec recurrent
-- orfe. Mateix criteri que `gift_vouchers`, on l'UPDATE és d'admin perquè és
-- la porta que fa bescanviable un val.
--
-- No costa res funcionalment: tota escriptura real passa pel servidor amb la
-- clau de servei —el preu i les sessions surten del catàleg, mai del
-- navegador—, i cancel·lar de veritat vol dir avisar Stripe, cosa que cap
-- política de RLS pot fer. Les polítiques hi són com a segona barrera i perquè
-- l'API directa quedi tancada.

alter table public.subscriptions enable row level security;

drop policy if exists "subscriptions_select" on public.subscriptions;
create policy "subscriptions_select" on public.subscriptions
  for select to authenticated
  using (
    public.is_admin()
    or public.owns_client(client_id)
    or public.is_trainer_of(client_id)
    or public.is_trainer()
  );

drop policy if exists "subscriptions_admin_write" on public.subscriptions;
create policy "subscriptions_admin_write" on public.subscriptions
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ─── Avisos ─────────────────────────────────────────────────────────────────
--
-- Els tres activats per defecte. Aquí es mouen diners sense que el client premi
-- res: assabentar-se'n no és una comoditat opcional. Mateix criteri que
-- `bono_unpaid_cancelled_email` a la 0044.

alter table public.notification_preferences
  add column if not exists subscription_renewed_email        boolean not null default true,
  add column if not exists subscription_payment_failed_email boolean not null default true,
  add column if not exists subscription_cancelled_email      boolean not null default true;
