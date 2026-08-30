-- ============================================================================
-- VindiBCN · 0059 — Qui vota pot veure el resultat, sense veure qui ha votat
--
-- La comunitat mostra els percentatges d'una enquesta un cop hi has respost.
-- Fins ara no es podia: `poll_responses_select` (migració 0031) deixa que un
-- client vegi NOMÉS les seves respostes, i està bé que sigui així —el vot del
-- veí no és cosa seva—. Però llavors tampoc pot comptar.
--
-- La sortida no és obrir la política. Si deixéssim llegir les files, cada
-- fila porta el `client_id`: qualsevol podria reconstruir qui ha votat què amb
-- una consulta. El que es fa és una funció SECURITY DEFINER que compta a dins
-- i només en treu el NÚMERO. Els identificadors no surten mai.
--
-- `stable` perquè no escriu res, i el `search_path` fixat perquè una funció
-- amb privilegis no ha de dependre del camí de qui la crida.
-- ============================================================================

create or replace function public.poll_option_counts(p_poll_ids uuid[])
returns table (option_id uuid, votes bigint)
language sql
security definer
set search_path = public
stable
as $$
  select r.option_id, count(*)::bigint as votes
  from public.poll_responses r
  where r.poll_id = any(p_poll_ids)
  group by r.option_id;
$$;

-- Qualsevol persona identificada la pot cridar: el resultat d'una enquesta del
-- centre és públic per als de dins. El que no és públic és qui l'ha votat, i
-- això la funció no ho torna.
grant execute on function public.poll_option_counts(uuid[]) to authenticated;
