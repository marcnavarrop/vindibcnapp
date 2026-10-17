-- ============================================================================
-- VindiBCN · 0125 — Notes de sessió: qui les pot LLEGIR
--
-- QUÈ PASSAVA (0079)
--
-- Llegia una nota de sessió: l'admin, el professional D'AQUELLA reserva i el
-- client. L'entrenador assignat del client no veia les notes de les sessions que
-- havia fet un altre (un grup amb un company, per exemple), i un fisio no veia
-- les de les sessions de fisioteràpia d'un altre fisio, tot i que formen part de
-- l'historial clínic que sí que pot llegir (0110).
--
-- QUÈ FA (decisió d'en Marc, 17/10/2026, opció B)
--
--   · Sessió de FISIOTERÀPIA: és historial clínic, i la llegeix qui llegeix
--     l'historial (0110): l'admin, QUALSEVOL fisio, l'entrenador ASSIGNAT del
--     client (només llegir) i el client. Cap altre entrenador.
--   · Qualsevol ALTRA sessió: l'admin, el professional d'aquella reserva,
--     l'entrenador ASSIGNAT del client i el client.
--   · Sempre «demo amb demo» (`same_world`): un professional demo només amb
--     clients demo, i a l'inrevés.
--   · ESCRIURE no canvia: només el professional d'aquella reserva
--     (`session_notes_trainer_write`, 0079).
--
-- Idempotent: `create or replace`, `drop policy if exists`.
-- ============================================================================

create or replace function public.can_read_session_note(rid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.reservations r
     where r.id = rid
       and (
         -- L'admin, tot.
         coalesce(public.is_admin(), false)
         -- El client, les seves.
         or exists (select 1 from public.clients c where c.id = r.client_id and c.profile_id = auth.uid())
         -- L'equip, sempre del mateix món (demo amb demo).
         or (
           public.same_world(r.client_id)
           and (
             case
               when r.service_type = 'fisioterapia' then
                 -- Historial clínic, com la 0110: qualsevol fisio, qui va fer
                 -- la sessió i l'entrenador assignat (aquest, només llegir).
                 public.is_physio() or r.trainer_id = auth.uid() or public.is_trainer_of(r.client_id)
               else
                 -- La resta: qui va fer la sessió i l'entrenador assignat.
                 r.trainer_id = auth.uid() or public.is_trainer_of(r.client_id)
             end
           )
         )
       )
  )
$$;

comment on function public.can_read_session_note(uuid) is
  'Qui pot llegir la nota d''aquesta sessió: admin; el client; el professional de la sessió i l''entrenador assignat; i, si és de fisioteràpia, qualsevol fisio. Sempre demo amb demo (0125).';

revoke execute on function public.can_read_session_note(uuid) from public, anon;
grant  execute on function public.can_read_session_note(uuid) to authenticated;

drop policy if exists "session_notes_select" on public.session_notes;
create policy "session_notes_select" on public.session_notes
  for select to authenticated
  using (public.can_read_session_note(reservation_id));

comment on table public.session_notes is
  'Nota de seguiment d''una sessió. La escriu el professional d''AQUELLA reserva. La llegeixen: admin, el client, el professional de la sessió, l''entrenador assignat i, si és de fisioteràpia, qualsevol fisio; demo amb demo (0079, 0125).';
