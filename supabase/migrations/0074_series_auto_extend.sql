-- ============================================================================
-- VindiBCN · 0074 — La sèrie que continua sola
--
-- L'assistent de reserva en bucle s'atura quan el bo s'acaba: genera fins on
-- arriben les sessions i compta la resta a `skippedForBono`. Amb una
-- subscripció (0072) això deixa de tenir sentit obligatori —cada mes n'arriben
-- de noves—, així que la sèrie pot allargar-se sola a cada renovació.
--
-- PER QUÈ ÉS UNA CASELLA I NO EL COMPORTAMENT PER DEFECTE
--
-- Perquè allargar una sèrie vol dir agafar places d'un grup de QUATRE. Un
-- subscriptor que hagi triat "dimarts a les 10" es quedaria aquella franja mes
-- rere mes sense tornar-hi a pensar, i la resta de clients trobarien el calendari
-- ocupat per decisions que ningú ha pres aquest mes. Que sigui una decisió
-- explícita, i per sèrie, és el que fa que el client sàpiga que l'està prenent.
--
-- Per defecte `false`: les sèries que ja existeixen no canvien de comportament
-- pel fet de desplegar això. Mateix criteri que `subscriptions_enabled`.
--
-- QUÈ NO CANVIA
--
-- Els límits de la sèrie continuen manant. `end_date` i `occurrence_count` són
-- els que diuen quan s'acaba, i l'extensió no els pot passar: una sèrie de deu
-- sessions en fa deu, es renovi el que es renovi. Una sèrie sense subscripció
-- amb la casella marcada no fa res: no hi ha res que l'allargui.
-- ============================================================================

alter table public.booking_series
  add column if not exists auto_extend boolean not null default false;

comment on column public.booking_series.auto_extend is
  'La sèrie s''allarga sola a cada renovació de la subscripció, fins als seus propis límits (end_date / occurrence_count). Per defecte false: agafar places d''un grup de quatre cada mes ha de ser una decisió explícita del client.';

-- La consulta de l'extensió: les sèries vives d'un client que s'han d'allargar.
-- Parcial perquè, si la funcionalitat s'usa poc, l'índex només conté les que hi
-- participen —que és el mateix criteri que la 0044 amb `first_reservation_at`.
create index if not exists booking_series_auto_extend
  on public.booking_series (client_id, service_type)
  where auto_extend and status = 'active';
