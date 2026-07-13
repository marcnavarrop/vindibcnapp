-- ============================================================================
-- VindiBCN · 0017 — Serveis oferts a cada franja de disponibilitat
--
-- Fins ara una regla de disponibilitat no deia QUÈ s'ofereix. Ara el que
-- determina què pot reservar un client és el TIPUS DE BO, no l'entrenador
-- assignat, així que cada franja ha de declarar quins serveis ofereix.
--
-- Opció A (array): una franja pot oferir diversos serveis (p. ex. un entrenador
-- que en aquella franja fa ep_individual o ep_parejas). Menys files i UI simple.
--
-- Backfill de les regles ja existents segons l'especialitat del professional
-- (fisioterapeuta → fisioteràpia; entrenador/sense → els tres d'entrenament),
-- per no trencar res.
-- ============================================================================
alter table public.availability_rules
  add column if not exists service_types public.service_type[] not null default '{}';

update public.availability_rules ar
set service_types = case
  when p.specialty = 'fisioterapeuta'
    then array['fisioterapia']::public.service_type[]
  else
    array['ep_individual', 'ep_parejas', 'grupo_reducido']::public.service_type[]
end
from public.profiles p
where p.id = ar.trainer_id
  and (ar.service_types is null or ar.service_types = '{}');
