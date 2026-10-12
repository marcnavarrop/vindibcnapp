-- ============================================================================
-- VindiBCN · 0108 — Qualsevol professional crea un bo de GRUP a qualsevol client
--
-- Ve del mateix tiquet que la 0107 (en Raul, 8/10): els clients de grup canvien
-- d'entrenador lliurement i molts no en tenen cap d'assignat. Decisió d'en Marc
-- (12/10/2026): qualsevol professional pot crear un bo de GRUP a qualsevol
-- client real. La resta de bons, com fins ara (només els propis, `0005`).
--
-- NOMÉS INSERT, I NOMÉS UN BO DE GRUP «NORMAL»
--
-- `bonos_trainer_write` (0005) és FOR ALL sobre els clients assignats i no es
-- toca. La política nova és PERMISSIVA (s'hi suma amb un OR) però només per a
-- INSERT, i el `with check` fixa com ha de ser el bo, com va fer la 0085 amb
-- cobrar:
--
--   · de grup, d'un paquet de grup actiu que NO sigui només per subscripció
--     (la subscripció segueix el seu camí, `subscribeAtCenter`);
--   · nou de trinca: actiu, amb totes les sessions, sense primera reserva;
--   · sense res de diners externs ni de cicles: ni subscripció, ni Stripe, ni
--     val de regal, ni renovació automàtica.
--
-- Editar-lo, esborrar-lo o anul·lar-lo després segueix essent del seu
-- professional o de l'admin; cobrar-lo, de qualsevol (0085).
--
-- «DEMO AMB DEMO» NO VIU AQUÍ: la base no sap quins comptes són de
-- demostració. Ho mira l'app (`createTrainerBonoAction`).
--
-- Idempotent: `drop policy if exists` abans de crear-la.
-- ============================================================================

drop policy if exists "bonos_trainer_insert_group" on public.bonos;
create policy "bonos_trainer_insert_group" on public.bonos
  for insert to authenticated
  with check (
    coalesce(public.is_trainer(), false)
    and service_type = 'grupo_reducido'
    and status = 'active'
    and remaining_sessions = total_sessions
    and first_reservation_at is null
    and subscription_id is null
    and subscription_cycle_start is null
    and is_subscription_extra = false
    and stripe_checkout_session_id is null
    and stripe_invoice_id is null
    and gift_voucher_id is null
    and renewed_from_bono_id is null
    and auto_renew = false
    and service_id is not null
    and exists (
      select 1 from public.services s
      where s.id = service_id
        and s.service_type = 'grupo_reducido'
        and s.active
        and not s.subscription_only
    )
  );

comment on policy "bonos_trainer_insert_group" on public.bonos is
  'Qualsevol professional crea un bo de GRUP nou (paquet de grup actiu, no només per subscripció, sense Stripe ni subscripció ni val) a qualsevol client (0108). La resta de bons, només els propis (bonos_trainer_write, 0005).';
