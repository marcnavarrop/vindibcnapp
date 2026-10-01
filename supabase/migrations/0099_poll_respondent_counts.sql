-- 0099 · Quantes PERSONES han respost cada enquesta.
--
-- «N respostes» comptava vots: en una enquesta de selecció múltiple, qui en
-- marca dues comptava dues vegades. Ara compta persones (`client_id` diferents).
--
-- Mateix patró que `poll_option_counts` (0059): la RLS de `poll_responses`
-- només deixa veure les pròpies respostes, així que el client no pot comptar
-- les dels altres. La funció és SECURITY DEFINER, compta a dins i només en
-- treu el NÚMERO; cap `client_id` surt d'aquí.
--
-- Només per a sessions identificades (com el tauler de la comunitat): es
-- treu l'execució per defecte de PUBLIC i d'anon.
--
-- Idempotent: es pot tornar a aplicar.

create or replace function public.poll_respondent_counts(p_poll_ids uuid[])
returns table (poll_id uuid, respondents bigint)
language sql
security definer
set search_path = public
stable
as $$
  select r.poll_id, count(distinct r.client_id)::bigint as respondents
  from public.poll_responses r
  where r.poll_id = any(p_poll_ids)
  group by r.poll_id;
$$;

revoke execute on function public.poll_respondent_counts(uuid[]) from public, anon;
grant execute on function public.poll_respondent_counts(uuid[]) to authenticated;
