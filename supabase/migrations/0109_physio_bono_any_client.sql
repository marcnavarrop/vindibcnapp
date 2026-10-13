-- ============================================================================
-- VindiBCN · 0109 — Un fisio crea un bo de FISIO a qualsevol client
--
-- Decisió d'en Marc (13/10/2026): el fisio és transversal. L'entrenador
-- s'assigna al client; el fisio no. Qualsevol fisio pot atendre qualsevol
-- client, en tingui o no d'entrenador, i per tant li ha de poder crear el bo de
-- fisio. És la peça «B» de la proposta del fisio; la resta (is_physio_of,
-- dades de salut) espera l'assessor.
--
-- MATEIX PATRÓ QUE LA 0108, EN UNA POLÍTICA A PART
--
-- La 0108 (`bonos_trainer_insert_group`) no es toca. Aquesta és una altra
-- política PERMISSIVA, només d'INSERT, que fixa com ha de ser el bo:
--
--   · qui el crea és professional AMB especialitat `fisioterapeuta` (la
--     especialitat només la canvia l'admin);
--   · de fisioteràpia, d'un paquet de fisio actiu que no sigui només per
--     subscripció;
--   · neix PENDENT DE PAGAMENT, no actiu (decisió d'en Marc): un fisio no pot
--     regalar sessions a un client que no és seu, i el cobrament queda per
--     fer (el pot fer qualsevol professional, 0085, o el client);
--   · nou de trinca: totes les sessions, sense primera reserva;
--   · sense subscripció, Stripe, val de regal ni renovació automàtica;
--   · amb les SESSIONS del paquet i el PREU del catàleg: el del paquet o el
--     que en dona una oferta activa d'aquell paquet o servei, calculat com
--     l'app (`computeEffectivePrice`): max(0, round(preu − estalvi)), a euros
--     sencers, amb el dia del centre (Europe/Madrid).
--
-- Als SEUS clients (assignats), un fisio segueix podent crear qualsevol bo com
-- fins ara (`bonos_trainer_write`, 0005). Un entrenador no guanya res: per a
-- ell, a un client que no és seu, només el de grup de la 0108.
--
-- Les columnes del bo van amb el nom de la taula (`bonos.price`): dins de les
-- subconsultes, `price` a seques seria el del paquet.
--
-- «DEMO AMB DEMO» NO VIU AQUÍ: la base no sap quins comptes són de
-- demostració. Ho mira l'app (`createTrainerBonoAction`).
--
-- Idempotent: `drop policy if exists` abans de crear-la.
-- ============================================================================

drop policy if exists "bonos_physio_insert_physio" on public.bonos;
create policy "bonos_physio_insert_physio" on public.bonos
  for insert to authenticated
  with check (
    coalesce(public.is_trainer(), false)
    and exists (
      select 1 from public.profiles me
      where me.id = auth.uid()
        and me.specialty = 'fisioterapeuta'
    )
    and service_type = 'fisioterapia'
    and status = 'pending_payment'
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
    and bonos.service_id is not null
    and exists (
      select 1 from public.services s
      where s.id = bonos.service_id
        and s.service_type = 'fisioterapia'
        and s.active
        and not s.subscription_only
        and bonos.total_sessions = s.default_sessions
        and (
          bonos.price = s.price
          or exists (
            select 1 from public.promotions p
            where p.active
              and p.starts_at <= (now() at time zone 'Europe/Madrid')::date
              and p.ends_at   >= (now() at time zone 'Europe/Madrid')::date
              and (
                (p.scope = 'package' and s.id = any (p.service_ids))
                or (p.scope = 'service' and s.service_type::text = any (p.service_types))
              )
              and bonos.price = greatest(
                0,
                round(s.price - case p.discount_type
                                  when 'percentage' then s.price * p.discount_value / 100
                                  else p.discount_value
                                end)
              )
          )
        )
    )
  );

comment on policy "bonos_physio_insert_physio" on public.bonos is
  'Un professional fisioterapeuta crea un bo de FISIO a qualsevol client (0109): pendent de pagament, nou, d''un paquet de fisio actiu i no només per subscripció, amb les sessions del paquet i el preu del catàleg o d''una oferta activa, sense Stripe, subscripció ni val. La resta de bons, com abans.';
