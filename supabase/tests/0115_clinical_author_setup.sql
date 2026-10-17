-- ============================================================================
-- VindiBCN · 0115 — preparació (NOMÉS si la prova diu «0: cal el pas de preparació»)
--
-- Aquestes SÍ que escriuen: entrades de prova del Fisio Demo al Client Demo, per
-- tenir-ne d'abans de la transacció de la prova. Cada una torna el seu id: guarda'l
-- per netejar-la després, per id exacte (bloc de sota, comentat). Només demo.
--
-- B1 · Un seguiment (el cas «queda orfe» abans de la 0115).
-- B2 · Una primera visita, només si el Client Demo no en té cap (el cas «l'esborrat
--      falla amb 23503» abans de la 0115). Passa la prova entre B1 i B2 per veure
--      els dos casos per separat.
-- ============================================================================

-- B1
insert into public.clinical_followups (client_id, author_id, body)
select c.id, '1c36928b-0668-4377-a5d8-c7befb2d78bc', 'Prova 0115 (entrada de prova: s''esborrarà)'
  from public.clients c
 where c.profile_id = 'd3b42dcb-7c11-4431-abc0-723b21add106'
returning id;

-- B2
insert into public.clinical_first_visits (client_id, body, created_by)
select c.id, 'Prova 0115 (primera visita de prova: s''esborrarà)', '1c36928b-0668-4377-a5d8-c7befb2d78bc'
  from public.clients c
 where c.profile_id = 'd3b42dcb-7c11-4431-abc0-723b21add106'
   and not exists (select 1 from public.clinical_first_visits v where v.client_id = c.id)
returning client_id;

-- Neteja, en acabar (amb els id que han tornat B1 i B2):
-- delete from public.clinical_followups where id = '<id de B1>';
-- delete from public.clinical_first_visits
--  where client_id = '<client_id de B2>'
--    and body = 'Prova 0115 (primera visita de prova: s''esborrarà)';
