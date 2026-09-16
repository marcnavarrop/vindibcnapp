-- ============================================================================
-- VindiBCN · 0085 — Cobrar el bo de qualsevol client, i anul·lar-ne un
--
-- Dues peticions que toquen les mateixes taules i per això viuen juntes.
--
-- ─── 1. COBRAR EL BO DE QUALSEVOL CLIENT ───────────────────────────────────
--
-- La 0056 va deixar que el professional cobrés el bo del SEU client. A la
-- pràctica qui té la persona al davant amb els diners a la mà no sempre és qui
-- la té assignada —es cobreixen baixes, es reparteixen hores—, i el criteri ja
-- establert per a la resta de la coordinació és que es VEU tot el centre i
-- s'escriu només el propi. Cobrar passa al costat de "veure": qualsevol
-- professional pot cobrar qualsevol bo.
--
-- El que NO s'amplia: crear un bo, esborrar-lo o tocar-ne el preu segueix sent
-- només per als clients assignats (`bonos_trainer_write`, 0005) o de l'admin.
--
-- Per això la política nova no és un FOR ALL sinó un UPDATE que fixa D'ON pot
-- venir el bo i ON ha d'acabar: de 'pending_payment' o 'unpaid' a 'active', i
-- res més. La RLS no sap restringir per columna, així que aquesta és la manera
-- d'obrir l'operació sense obrir la taula.
--
-- ─── 2. ANUL·LAR UN BO ──────────────────────────────────────────────────────
--
-- 'cancelled' existeix a l'enum des de la 0001 i no l'ha escrit mai ningú: era
-- lletra morta. Passa a tenir ús, amb una regla UNIFORME que la base també
-- comprova:
--
--   · Cap sessió gastada: `remaining_sessions = total_sessions`. Anul·lar no
--     pot ser la drecera per esborrar feina ja feta, i com que reservar
--     descompta a l'instant (0084), un bo intacte és un bo sense cap reserva
--     viva. La condició és la mateixa per als pendents i per als actius.
--   · Res de subscripcions: un bo amb `subscription_id` és el mes d'una quota,
--     i donar-se de baixa té el seu camí. Anul·lar el bo deixaria la
--     subscripció viva i el mes que ve en naixeria un altre.
--
-- QUI POT, I PER QUÈ NO ÉS EL MATEIX ALS DOS ESTATS
--
--   · 'pending_payment' → qualsevol professional. No s'ha cobrat res: anul·lar
--     un encàrrec que no s'ha pagat no mou cap número.
--   · 'active'          → NOMÉS l'admin, per `bonos_admin_write` (0001), que
--     ja hi arriba i no cal tocar. Un bo actiu s'ha cobrat, i a `payments` no
--     hi ha cap manera d'anotar una devolució: la columna `amount` té un
--     CHECK (amount >= 0) i no existeix cap taula de retorns. Anul·lar-lo
--     deixa diners cobrats al llibre i un bo que ja no val: és una esmena
--     comptable, i això segueix sent de l'admin com diu la 0056.
--
-- ─── 3. EL COBRAMENT HA DE PODER LLEGIR-SE A SI MATEIX ──────────────────────
--
-- `payments_trainer_insert` s'amplia a `is_trainer()`, però amb això sol no
-- n'hi hauria prou. `createPayment` escriu amb INSERT ... RETURNING id, i un
-- RETURNING demana permís de SELECT sobre la fila que torna. `payments_select`
-- (0001) només arriba a `is_trainer_of`, així que un professional cobrant un bo
-- d'un client aliè hauria inserit la fila i hauria petat en llegir-la: el bo
-- activat i el cobrament sense registrar. És exactament el forat que la 0056 va
-- tapar, tornant per l'altra banda.
--
-- Efecte lateral acceptat: un professional passa a veure l'històric de
-- cobraments de qualsevol client. És la mateixa obertura que ja tenen bons,
-- clients i reserves per coordinar-se.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Cobrar: de pendent o decaigut, a actiu. Qualsevol professional.
-- ---------------------------------------------------------------------------
drop policy if exists "bonos_trainer_collect_any" on public.bonos;
create policy "bonos_trainer_collect_any" on public.bonos
  for update
  using (
    public.is_trainer()
    and status in ('pending_payment', 'unpaid')
  )
  with check (
    public.is_trainer()
    and status = 'active'
  );

comment on policy "bonos_trainer_collect_any" on public.bonos is
  'Qualsevol professional pot cobrar qualsevol bo: de pending_payment o unpaid a active, i res més. Crear, esborrar o canviar-ne el preu segueix sent només dels clients assignats (bonos_trainer_write) o de l''admin.';

-- ---------------------------------------------------------------------------
-- 2. Anul·lar un bo PENDENT, intacte i sense subscripció. Qualsevol
--    professional. Els actius no hi entren: són de l'admin.
-- ---------------------------------------------------------------------------
drop policy if exists "bonos_trainer_cancel_pending" on public.bonos;
create policy "bonos_trainer_cancel_pending" on public.bonos
  for update
  using (
    public.is_trainer()
    and status = 'pending_payment'
    -- Cap sessió gastada. Com que reservar descompta a l'instant, això vol dir
    -- també cap reserva viva. Es comprova aquí i no només al servidor: és la
    -- regla que evita que anul·lar esborri feina feta.
    and remaining_sessions = total_sessions
    -- El mes d'una subscripció no s'anul·la per aquí.
    and subscription_id is null
  )
  with check (
    public.is_trainer()
    and status = 'cancelled'
  );

comment on policy "bonos_trainer_cancel_pending" on public.bonos is
  'El professional pot anul·lar un bo pendent de pagament que estigui intacte (remaining = total, i per tant sense reserves vives) i que no sigui d''una subscripció. Anul·lar un bo ja cobrat és de l''admin: a payments no hi ha manera d''anotar una devolució.';

-- ---------------------------------------------------------------------------
-- 3. El cobrament: inserir-lo i poder-lo llegir tot seguit.
-- ---------------------------------------------------------------------------
drop policy if exists "payments_trainer_insert" on public.payments;
create policy "payments_trainer_insert" on public.payments
  for insert
  with check (public.is_trainer());

comment on policy "payments_trainer_insert" on public.payments is
  'El professional pot registrar el cobrament de qualsevol client (marcar un bo com pagat). Només INSERT: esmenar o esborrar un cobrament segueix sent de l''admin.';

drop policy if exists "payments_select" on public.payments;
create policy "payments_select" on public.payments
  for select using (
    public.is_admin()
    or public.owns_client(client_id)
    or public.is_trainer_of(client_id)
    -- Afegit per la 0085. Sense això, el RETURNING del cobrament d'un client
    -- aliè torna buit i l'operació peta amb el bo ja activat.
    or public.is_trainer()
  );

comment on policy "payments_select" on public.payments is
  'Admin, el propi client, i qualsevol professional (coordinació + el RETURNING del seu propi INSERT).';
