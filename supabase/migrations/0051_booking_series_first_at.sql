-- ============================================================================
-- VindiBCN · 0051 — La sèrie desa d'on surt
--
-- `booking_series` guardava la freqüència, el final i el professional, però no
-- la franja d'origen. Amb una sèrie que havia sortit malament no hi havia
-- manera de saber, mirant la fila, quina sessió l'havia originat: es va haver
-- de reproduir el cas a mà per esbrinar-ho.
--
-- És justament el que fa falta per lligar la sèrie amb la reserva que la va
-- iniciar (que ara s'hi adopta en comptes de quedar-se fora), i per poder
-- respondre "d'on venia això?" sense reconstruir-ho.
-- ============================================================================

alter table public.booking_series
  add column if not exists first_at timestamptz;

comment on column public.booking_series.first_at is
  'Instant de la sessió d''origen: la que es va triar al calendari i des de la qual es repeteix. Null a les sèries anteriors a aquesta columna.';
