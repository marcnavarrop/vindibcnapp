-- ============================================================================
-- VindiBCN · 0116 — preparació (NOMÉS si la prova diu «0: cal el pas de preparació»)
--
-- Aquesta SÍ que escriu: un registre de progrés apuntat pel Fisio Demo a un
-- exercici del Client Demo. Si el Client Demo no té cap exercici assignat, n'hi
-- assigna un (el primer de la biblioteca), marcat a les notes per poder-lo
-- treure després. Torna els id: guarda'ls per netejar-ho per id exacte (bloc de
-- sota, comentat). Només comptes demo.
-- ============================================================================

with c as (
  select id from public.clients where profile_id = 'd3b42dcb-7c11-4431-abc0-723b21add106'
),
existent as (
  select ce.id from public.client_exercises ce join c on ce.client_id = c.id
   order by ce.assigned_at limit 1
),
nou as (
  insert into public.client_exercises (client_id, exercise_id, assigned_by, notes)
  select c.id, (select e.id from public.exercises e order by e.created_at, e.id limit 1),
         '5119e112-74af-4c85-862b-829f6d726ea2', 'Prova 0116 (s''esborrarà)'
    from c
   where not exists (select 1 from existent)
  returning id
),
ce as (
  select id from existent union all select id from nou
)
insert into public.exercise_progress (client_exercise_id, recorded_at, weight_kg, reps, notes, recorded_by)
select id, current_date - 1, 20, 10, 'Prova 0116 (s''esborrarà)', '1c36928b-0668-4377-a5d8-c7befb2d78bc'
  from ce
returning id as progres_id, client_exercise_id;

-- Neteja, en acabar (amb els id que ha tornat l'insert):
-- delete from public.exercise_progress where id = '<progres_id>';
-- Només si l'exercici l'ha assignat aquesta preparació (si no, no esborra res):
-- delete from public.client_exercises
--  where id = '<client_exercise_id>' and notes = 'Prova 0116 (s''esborrarà)';
