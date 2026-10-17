-- ============================================================================
-- VindiBCN · 0126 — Notes de sessió: escriure, demo amb demo i sense llegir per la porta del darrere
--
-- La 0079 va crear `session_notes_trainer_write` com a `for all`: a més
-- d'escriure, deixava LLEGIR el professional de la sessió sense mirar
-- `same_world`, i les policies permissives se sumen. Ho va destapar la prova
-- de la 0125 (un fisio demo fet «real» encara veia les notes del Client Demo).
-- Ara llegir només ho decideix `session_notes_select` (0125), i escriure va en
-- tres policies (insert, update, delete) que demanen el mateix d'abans
-- (el professional d'AQUELLA reserva, signant com a autor) més demo amb demo.
--
-- Idempotent: `drop policy if exists`.
-- ============================================================================

drop policy if exists "session_notes_trainer_write" on public.session_notes;

drop policy if exists "session_notes_trainer_insert" on public.session_notes;
create policy "session_notes_trainer_insert" on public.session_notes
  for insert to authenticated
  with check (
    public.is_session_trainer(reservation_id)
    and author_id = auth.uid()
    and public.same_world((select r.client_id from public.reservations r where r.id = reservation_id))
  );

drop policy if exists "session_notes_trainer_update" on public.session_notes;
create policy "session_notes_trainer_update" on public.session_notes
  for update to authenticated
  using (
    public.is_session_trainer(reservation_id)
    and public.same_world((select r.client_id from public.reservations r where r.id = reservation_id))
  )
  with check (
    public.is_session_trainer(reservation_id)
    and author_id = auth.uid()
    and public.same_world((select r.client_id from public.reservations r where r.id = reservation_id))
  );

drop policy if exists "session_notes_trainer_delete" on public.session_notes;
create policy "session_notes_trainer_delete" on public.session_notes
  for delete to authenticated
  using (
    public.is_session_trainer(reservation_id)
    and public.same_world((select r.client_id from public.reservations r where r.id = reservation_id))
  );
