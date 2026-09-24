-- ============================================================================
-- 0092 · Les subscripcions ja no les llegeix qualsevol professional
-- ============================================================================
--
-- DUES COSES, I CAP NO CANVIA RES DEL QUE FA L'APLICACIÓ
--
-- 1. `subscriptions_select`. La 0072 hi va posar `or public.is_trainer()`, i
--    amb això qualsevol professional podia llegir per l'API directa el preu i
--    els identificadors de Stripe (`stripe_customer_id`,
--    `stripe_subscription_id`) de TOTS els clients.
--
--    L'aplicació no en depèn. Totes les lectures de subscripcions van amb la
--    clau de servei (`lib/data/subscriptions.ts`), també les de les pantalles
--    del professional (`/trainer/bonos/new`, l'alta «al centre» del
--    BonoForm), i l'única funció SQL que hi llegeix (`claim_subscription_extra`,
--    0073) només l'executa `service_role`. La política és la segona barrera, i
--    tal com estava no barrava res.
--
--    Es queda `is_trainer_of`: el professional ASSIGNAT, com a la resta de
--    taules del client.
--
-- 2. Un comentari a `session_notes_author_idx`. La 0079 deia que servia «per
--    llistar les notes d'un client», i cap consulta no el fa servir per a
--    això. Però no sobra: `author_id` apunta a `profiles` amb
--    `on delete set null`, i quan es dona de baixa un professional
--    (`gdpr-delete`) Postgres ha de trobar les seves notes per buidar-los la
--    signatura. Sense l'índex, això recorreria la taula sencera. Es diu aquí
--    perquè ningú no l'esborri pensant que és mort.
-- ============================================================================

-- ─── 1. Lectura de subscripcions ─────────────────────────────────────────────

drop policy if exists "subscriptions_select" on public.subscriptions;
create policy "subscriptions_select" on public.subscriptions
  for select to authenticated
  using (
    public.is_admin()
    or public.owns_client(client_id)
    or public.is_trainer_of(client_id)
  );

-- ─── 2. Per a què serveix l'índex de l'autor ─────────────────────────────────

comment on index public.session_notes_author_idx is
  'Per a l''ON DELETE SET NULL de profiles (gdpr-delete): troba les notes d''un professional que es dona de baixa. No el fa servir cap consulta de l''aplicació (0092).';
