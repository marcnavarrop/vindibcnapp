-- ============================================================================
-- VindiBCN · 0007 — Garantía de no solapamiento (concurrencia)
--
-- Índice único parcial: como máximo UNA reserva 'booked' por (entrenador, hora)
-- para servicios que NO sean de grupo. Esto convierte el control de solape en
-- una garantía a nivel de base de datos: si dos clientes intentan reservar la
-- misma franja a la vez, la segunda inserción falla (y la app le devuelve la
-- sesión al bono y muestra "franja ocupada"). 'grupo_reducido' queda excluido
-- porque admite varios asistentes (el aforo se valida en la aplicación).
-- ============================================================================

create unique index if not exists uniq_reservation_slot_non_group
  on public.reservations (trainer_id, scheduled_at)
  where status = 'booked' and service_type <> 'grupo_reducido';
