-- ============================================================================
-- VindiBCN · 0044 — Anul·lació de bons pendents de pagament no cobrats
--
-- Xarxa de seguretat de la decisió que "pagar al centre" ja permet reservar a
-- l'instant: si el pagament no arriba, el bo decau i les sessions futures que
-- ocupava tornen a estar lliures per a algú altre.
--
-- El comptador arrenca a la PRIMERA reserva feta amb el bo, no a la compra: qui
-- compra i encara no reserva no ocupa cap franja a ningú, així que no hi ha res
-- a alliberar ni cap pressa per anul·lar-li res.
-- ============================================================================

alter table public.center_settings
  add column if not exists pending_payment_cancel_enabled boolean not null default false,
  add column if not exists pending_payment_cancel_hours integer
    check (pending_payment_cancel_hours is null
           or pending_payment_cancel_hours between 1 and 8760);

comment on column public.center_settings.pending_payment_cancel_enabled is
  'Si els bons pendents de pagament s''anul·len quan passa el termini sense cobrar.';
comment on column public.center_settings.pending_payment_cancel_hours is
  'Hores des de la primera reserva feta amb el bo. Només s''aplica si pending_payment_cancel_enabled.';

-- ─── Quan va començar a comptar ─────────────────────────────────────────────
alter table public.bonos
  add column if not exists first_reservation_at timestamptz;

comment on column public.bonos.first_reservation_at is
  'Instant de la PRIMERA reserva feta amb aquest bo. S''escriu un sol cop i ja no es toca, ni que aquella reserva es cancel·li després: el termini de pagament no es reinicia reservant i desreservant.';

-- Consulta del barrido: pendents de pagament que ja han estrenat el bo.
create index if not exists bonos_pending_payment_sweep
  on public.bonos (status, first_reservation_at)
  where first_reservation_at is not null;

-- ─── Estat nou ──────────────────────────────────────────────────────────────
-- Ni 'cancelled' (que vol dir "l'admin l'ha anul·lat") ni 'expired' (que vol
-- dir "se li va passar el temps de fer-lo servir"). Aquí el motiu és un tercer
-- i el client necessita saber-lo per poder-hi fer alguna cosa: no es va
-- detectar el pagament. Mateix criteri que va separar 'expired' de 'completed'.
alter type public.bono_status add value if not exists 'unpaid';

-- ─── Preferència de l'avís ──────────────────────────────────────────────────
-- Activat per defecte: al client se li han cancel·lat sessions; assabentar-se'n
-- no és opcional.
alter table public.notification_preferences
  add column if not exists bono_unpaid_cancelled_email    boolean not null default true,
  add column if not exists bono_unpaid_cancelled_whatsapp boolean not null default false;
