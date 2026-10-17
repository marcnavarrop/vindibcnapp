-- ============================================================================
-- VindiBCN · 0120 — Avís legal: registre sanitari i fisioterapeutes col·legiats
--
-- Textos legals definitius (17/10/2026). L'avís legal porta un apartat de
-- fisioteràpia amb dues dades del centre que fins ara no teníem enlloc:
--
--   · `health_registry_number`: el número d'inscripció al Registre de centres,
--     serveis i establiments sanitaris de Catalunya.
--   · `physio_collegiates`: els fisioterapeutes col·legiats, una llista de
--     {"name": "…", "number": "…"} (nom i núm. de col·legiat al CFC).
--
-- Totes dues són OPCIONALS. Buides, l'avís legal no pinta la frase que en
-- depèn (mai un claudàtor). S'omplen a Configuració → Centre (admin).
--
-- Mateix criteri que la 0100: buit és NULL (o la llista buida), mai una cadena
-- buida; ho garanteixen els checks. LECTURA i ESCRIPTURA, les de sempre de la
-- fila: la llegeix qualsevol sessió (dades públiques del centre), les pàgines
-- sense sessió les reben del servidor, i només l'admin hi escriu.
--
-- Idempotent: es pot tornar a aplicar.
-- ============================================================================

alter table public.center_settings
  add column if not exists health_registry_number text,
  add column if not exists physio_collegiates     jsonb not null default '[]'::jsonb;

alter table public.center_settings drop constraint if exists center_settings_health_registry_number_chk;
alter table public.center_settings add constraint center_settings_health_registry_number_chk
  check (health_registry_number is null
         or (health_registry_number = btrim(health_registry_number)
             and length(health_registry_number) between 2 and 40));

-- Cada element: un objecte amb `name` (2–120) i `number` (1–20), sense espais
-- als extrems i sense cap altra clau. Com a molt 20 persones.
create or replace function public.center_physio_collegiates_ok(p jsonb)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  e jsonb;
begin
  if p is null or jsonb_typeof(p) <> 'array' or jsonb_array_length(p) > 20 then
    return false;
  end if;
  for e in select * from jsonb_array_elements(p) loop
    if jsonb_typeof(e) <> 'object'
       or (select count(*) from jsonb_object_keys(e)) <> 2
       or jsonb_typeof(e->'name') is distinct from 'string'
       or jsonb_typeof(e->'number') is distinct from 'string'
       or e->>'name' <> btrim(e->>'name') or length(e->>'name') not between 2 and 120
       or e->>'number' <> btrim(e->>'number') or length(e->>'number') not between 1 and 20
    then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

comment on function public.center_physio_collegiates_ok(jsonb) is
  'Check de center_settings.physio_collegiates: llista de {name, number} ben formada (0120).';

alter table public.center_settings drop constraint if exists center_settings_physio_collegiates_chk;
alter table public.center_settings add constraint center_settings_physio_collegiates_chk
  check (public.center_physio_collegiates_ok(physio_collegiates));

comment on column public.center_settings.health_registry_number is
  'Núm. d''inscripció al Registre de centres, serveis i establiments sanitaris de Catalunya. Opcional: buit, l''avís legal no ho diu (0120).';
comment on column public.center_settings.physio_collegiates is
  'Fisioterapeutes col·legiats: [{"name": "…", "number": "…"}]. Opcional: buit, l''avís legal no pinta l''apartat (0120).';
