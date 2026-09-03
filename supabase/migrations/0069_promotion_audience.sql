-- ============================================================================
-- VindiBCN · 0069 — A qui va dirigida una oferta
--
-- Fins ara una oferta deia QUÈ rebaixa (scope: un tipus de servei o uns paquets
-- concrets) però no A QUI. Anava a tothom. Aquesta migració hi afegeix el segon
-- eix, amb tres valors:
--
--   'all'         → tothom, que és el comportament d'avui.
--   'tag'         → només els clients amb una etiqueta concreta (0068).
--   'active_bono' → només els clients amb un bo actiu d'un tipus de servei.
--
-- DEPÈN DE LA 0068: `audience_tag_id` referencia `client_tags`. S'apliquen en
-- ordre.
--
-- PER QUÈ 'active_bono' VA PER TIPUS DE SERVEI I NO PER PAQUET
--
-- Perquè `bonos` guarda `service_type` i NO `service_id` (0001): un bo no
-- recorda de quin paquet del catàleg va sortir. "Té un bo actiu de
-- fisioteràpia" es pot preguntar; "té un bo actiu del paquet Fisio 5 sessions"
-- no, i fer-ho possible voldria dir omplir un `service_id` que no existeix en
-- cap dels bons ja venuts. La UI ho diu tal com és: "tipus de servei".
--
-- QUÈ ÉS UN BO ACTIU, AQUÍ
--
-- `status = 'active'` i no caducat. Deliberadament NO inclou 'pending_payment',
-- encara que la resta de l'aplicació el compti com a utilitzable (`USABLE`, a
-- lib/data/bonos.ts, i el recompte "Bons actius" de la fitxa). La raó és que
-- aquí el bo no és informació sinó una clau: si un bo sense pagar obrís el
-- descompte, n'hi hauria prou amb encarregar un bo i no pagar-lo per accedir-hi.
-- És una divergència volguda amb el criteri general, no un descuit.
--
-- RETROCOMPATIBLE: `default 'all'` deixa les ofertes existents exactament com
-- estaven, i el constraint es compleix sol per a totes elles.
-- ============================================================================

-- `create type` no és idempotent: cal el guard per poder reexecutar el fitxer.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'promotion_audience') then
    create type public.promotion_audience as enum (
      'all',         -- qualsevol client
      'tag',         -- els que tenen l'etiqueta `audience_tag_id`
      'active_bono'  -- els que tenen un bo actiu de `audience_service_type`
    );
  end if;
end
$$;

alter table public.promotions
  add column if not exists audience public.promotion_audience not null default 'all',
  -- `restrict` i no `cascade`: esborrar una etiqueta no pot canviar en silenci a
  -- qui va dirigida una oferta —ni, pitjor encara, obrir-la a tothom. Si l'etiqueta
  -- s'usa, l'admin ha de tocar l'oferta primer. L'error de la base és el que es vol.
  add column if not exists audience_tag_id uuid references public.client_tags (id) on delete restrict,
  -- text i no l'enum `service_type`, mateix criteri que `service_rates.service_type` (0038).
  add column if not exists audience_service_type text;

comment on column public.promotions.audience is
  'A qui arriba l''oferta: tothom, els d''una etiqueta, o els que tenen un bo actiu d''un tipus de servei.';
comment on column public.promotions.audience_tag_id is
  'Etiqueta destinatària quan audience=''tag''. Null en qualsevol altre cas.';
comment on column public.promotions.audience_service_type is
  'Tipus de servei del bo actiu que obre l''oferta quan audience=''active_bono''. Null en qualsevol altre cas. Bo actiu = status ''active'' i no caducat; NO compta ''pending_payment''.';

-- Exactament un camp informat segons el valor d'audience, i cap quan és 'all'.
-- Mateix patró que `promotions_scope_check` (0026): que no hi pugui haver una
-- fila que digui dues coses alhora.
alter table public.promotions drop constraint if exists promotions_audience_check;
alter table public.promotions add constraint promotions_audience_check check (
  (audience = 'all'
    and audience_tag_id is null
    and audience_service_type is null)
  or
  (audience = 'tag'
    and audience_tag_id is not null
    and audience_service_type is null)
  or
  (audience = 'active_bono'
    and audience_service_type is not null
    and audience_tag_id is null)
);

-- Consulta dominant: "quines ofertes vives hi ha avui", que ja existia (0023,
-- `promotions_active_dates`). L'audiència no hi afegeix cap filtre a la base
-- —es resol en memòria sobre les poques ofertes vives— així que no cal índex
-- nou. Sí que en cal un per a la pregunta inversa, que fa l'admin en esborrar
-- una etiqueta: "quines ofertes la fan servir".
create index if not exists promotions_audience_tag
  on public.promotions (audience_tag_id)
  where audience_tag_id is not null;
