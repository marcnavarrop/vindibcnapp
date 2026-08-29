-- ============================================================================
-- VindiBCN · 0055 — Fora WhatsApp
--
-- El canal es va deixar preparat al model des de la 0019 —columnes, adaptador,
-- una columna a la UI— esperant connectar Twilio o la Cloud API. S'ha decidit
-- que no es farà mai, així que se'n va tot: el que queda a mig fer no és una
-- opció oberta, és una casella morta que cada persona que entri a
-- Configuració ha d'aprendre a ignorar.
--
-- No hi ha cap enum a desmuntar: `notification_log.channel` sempre ha estat
-- `text` lliure, sense check ni tipus propi. Per això aquesta migració no en
-- toca cap i les files antigues no poden quedar il·legibles.
--
-- El trigger `handle_new_profile_prefs()` només insereix `profile_id`, no
-- anomena cap columna, així que no cal refer-lo.
-- ============================================================================

-- ─── a) Les preferències ────────────────────────────────────────────────────
--
-- Cap de les 11 files existents en tenia ni una de posada a true: el canal no
-- ha funcionat mai i la UI les enviava sempre desactivades. No es perd cap
-- decisió de ningú.

alter table public.notification_preferences
  drop column if exists reservation_confirmed_whatsapp,
  drop column if exists reservation_cancelled_whatsapp,
  drop column if exists session_reminder_whatsapp,
  drop column if exists trial_request_whatsapp,
  drop column if exists trial_status_whatsapp,
  drop column if exists bono_low_whatsapp,
  drop column if exists community_whatsapp,
  drop column if exists trainer_booking_received_whatsapp,
  drop column if exists trainer_booking_cancelled_whatsapp,
  drop column if exists trainer_daily_agenda_whatsapp,
  drop column if exists new_client_registered_whatsapp,
  drop column if exists new_exercises_assigned_whatsapp,
  drop column if exists bono_expiring_soon_whatsapp,
  drop column if exists bono_unpaid_cancelled_whatsapp,
  drop column if exists gift_voucher_redeemed_whatsapp,
  drop column if exists waitlist_fulfilled_whatsapp;

-- ─── b) El rastre al log ────────────────────────────────────────────────────
--
-- 263 files, totes 'skipped_preference'. No registren cap fet: diuen que no es
-- va enviar res per un canal que no ha existit mai, i eren la meitat del log.
--
-- Es podien deixar sense trencar res —`channel` és text i cap pantalla llegeix
-- aquesta taula—, però aleshores l'auditoria d'enviaments continuaria sent
-- meitat soroll per sempre. El filtre és per canal i prou: les d'email no es
-- toquen.

delete from public.notification_log where channel = 'whatsapp';
