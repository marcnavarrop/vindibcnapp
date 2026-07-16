-- ============================================================================
-- VindiBCN · 0020 — Notificacions d'agenda per al professional
--
-- Fins ara reservation_confirmed/cancelled només avisaven el CLIENT. Ara el
-- professional (trainer/fisio) rep avisos propis quan un client li reserva o li
-- cancel·la una sessió, i opcionalment un resum diari de la seva agenda.
-- Columnes noves a notification_preferences (defaults per als operatius = true;
-- el resum diari opcional = false; tot WhatsApp = false).
-- ============================================================================
alter table public.notification_preferences
  add column if not exists trainer_booking_received_email    boolean not null default true,
  add column if not exists trainer_booking_received_whatsapp boolean not null default false,
  add column if not exists trainer_booking_cancelled_email   boolean not null default true,
  add column if not exists trainer_booking_cancelled_whatsapp boolean not null default false,
  add column if not exists trainer_daily_agenda_email        boolean not null default false,
  add column if not exists trainer_daily_agenda_whatsapp     boolean not null default false;

-- Les files existents agafen els defaults automàticament (no cal backfill).
