-- ============================================================================
-- VindiBCN · 0086 — «Només per subscripció» passa a ser una casella del catàleg
--
-- La 0072 va decidir que les subscripcions eren NOMÉS per a 'grupo_reducido', i
-- ho va clavar a la base amb un check. La 0085 i el commit del 18 de setembre
-- van tancar el cercle per l'altra banda: un bo de grup ja no es podia comprar
-- solt de cap manera. Les dues regles anaven lligades al TIPUS de servei
-- sencer.
--
-- Això s'ha demostrat massa gruixut, i es va veure en quatre dies.
--
-- EL QUE VA PASSAR DE DEBÒ
--
-- El 14 de setembre es van donar d'alta dos paquets nous de 'grupo_reducido'
-- des del catàleg: 'Sessió individual' (35 €, 1 sessió) i 'Bo de 6 sessions'
-- (132 €, 6 sessions). El 18 de setembre la regla «el grup només per
-- subscripció» els va deixar INVENDIBLES sense que ningú ho decidís: no eren
-- mensualitats, però compartien el tipus amb les que sí ho són.
--
-- Els noms del catàleg ja distingien les dues idees —«Mensualitat de X
-- sessions» contra «Bo»/«Sessió»— i el codi no ho veia. Aquesta migració fa que
-- ho vegi.
--
-- LA GRANULARITAT CORRECTA ÉS EL PAQUET, NO EL TIPUS
--
-- `services` sempre ha estat una fila per paquet concret (la 0011 ho diu
-- explícitament). Dins d'un mateix 'grupo_reducido' hi conviuen avui cinc
-- paquets, i que un sigui mensualitat no diu res de l'altre. La casella va a la
-- fila.
--
-- PER QUÈ ES RETIRA EL CHECK DE LA 0072 I NO ES SUBSTITUEIX PER UN TRIGGER
--
-- No és una renúncia: és que la regla ha canviat de naturalesa. A la 0072
-- «només grup» era una decisió de producte IMMUTABLE, i per això tocava clavar-
-- la a la base —el comentari d'allà ja deia que el dia que s'obrís quedaria dit
-- en una migració, i aquesta n'és la migració—. Ara passa a ser CONFIGURACIÓ
-- que l'administració canvia des d'una pantalla, i una configuració editable no
-- es defensa amb un constraint: el fet mateix que sigui editable vol dir que la
-- base no sap quin és el valor correcte.
--
-- Un trigger que consultés `services.subscription_only` tampoc serviria sense
-- fer mal: desmarcar la casella d'un paquet faria rebotar qualsevol UPDATE
-- sobre les subscripcions vives d'aquell paquet —renovar-les, pausar-les,
-- cancel·lar-les—, i el centre es trobaria amb files que no es poden ni tancar.
--
-- EL QUE LA BASE SEGUEIX GARANTINT, QUE ÉS EL QUE IMPORTA
--
-- Res del que evita cobrar dues vegades es toca. Segueixen en peu i intactes:
--
--   · subscriptions_one_live_per_client  — una subscripció viva per client i
--                                          tipus de servei
--   · subscriptions_stripe_uidx          — una subscripció de Stripe és una
--   · bonos_subscription_cycle_uidx      — un bo base per cicle
--   · bonos_stripe_invoice_uidx          — una factura, un bo
--
-- La garantia es mou de «què es pot subscriure» (ara configurable) a «no es pot
-- subscriure ni cobrar dos cops» (segueix sent inviolable).
--
-- QUÈ NO GENERALITZA AQUESTA MIGRACIÓ, I ÉS IMPORTANT DIR-HO
--
-- L'AFORAMENT NO. Un grup són quatre places perquè a la sala hi caben quatre
-- persones, i això no té res a veure amb com es paga. `GROUP_CAPACITY` segueix
-- essent de 'grupo_reducido' i prou.
--
-- LA PROHIBICIÓ DE SÈRIES TAMPOC. Que una reserva de grup no es pugui repetir
-- en bucle NO és perquè vagi per subscripció: és perquè una sèrie infinita
-- bloqueja una de les quatre places per sempre. És una regla d'aforament vista
-- des de l'altre costat, i per tant continua anant per tipus de servei. Fins
-- avui les dues condicions coincidien perquè només hi havia un tipus
-- subscribible; en separar-les, quedaria absurd en les dues direccions —un 'Bo
-- de 6 sessions' de grup sense casella podria obrir una sèrie eterna damunt de
-- les quatre places, i un 'ep_individual' amb casella no podria repetir-se sense
-- que hi hagi cap aforament que protegir—. Al codi, `isSubscriptionOnly` i
-- `canRepeatInSeries` passen a viure en fitxers separats per això mateix.
--
-- HI HA UN DETALL D'ESQUEMA QUE HO FA OBLIGATORI, A MÉS DE CORRECTE: `bonos` i
-- `reservations` guarden `service_type` i NO `service_id` (0001, i la 0069 ja
-- ho va deixar escrit). Un cop venut un bo, de quin paquet va sortir no consta
-- enlloc. La regla de compra pot mirar el paquet perquè encara el té al davant;
-- la de sèries no el tindrà mai.
-- ============================================================================

-- ─── La casella ─────────────────────────────────────────────────────────────

alter table public.services
  add column if not exists subscription_only boolean not null default false;

comment on column public.services.subscription_only is
  'Aquest paquet NOMÉS es pot tenir per subscripció mensual: no es ven solt, ni es dona d''alta a mà des de la fitxa, ni es regala en un val. Es configura a Catàleg → Serveis. No diu res de l''aforament ni de si les seves reserves es poden repetir en sèrie: això va pel tipus de servei.';

-- ─── Qui neix marcat ────────────────────────────────────────────────────────
--
-- PER ID EXACTE, i no per `name like 'Mensualitat%'`. Els noms d'aquestes files
-- ja s'han editat dues vegades —la 0022 hi va afegir el «de», i el pas de «Bo de
-- X sessions» a «Mensualitat de X sessions» es va fer des de la UI i no consta
-- en cap migració—. Qualsevol coincidència per text seria fràgil contra la
-- pròxima edició del catàleg.
--
-- Són les tres mensualitats de grup, i NOMÉS elles. Els dos paquets del 14 de
-- setembre es queden a false i per tant es podran vendre solts a partir d'ara:
-- NO és un backfill incomplet, és l'objectiu d'aquesta migració.
--
--   10a88b7b-32d2-46a2-829c-7adaa36fcfe5  Sessió individual   35 €  1 sessió  → false
--   c313b619-4139-45c4-ae6d-3516bfdee020  Bo de 6 sessions   132 €  6 sessions → false

update public.services
set subscription_only = true
where id in (
  'cf9dcb07-103d-4559-b9b2-954fab54590c',  -- Mensualitat de 2 sessions ·  50 €
  'e1804e83-593c-48eb-b54a-b845845902c2',  -- Mensualitat de 4 sessions ·  80 €
  '11c0774b-2050-442f-808c-01a195ce2f83'   -- Mensualitat de 8 sessions · 140 €
);

-- ─── Es retira el check de la 0072 ──────────────────────────────────────────
--
-- La subscripció viva que hi ha ara mateix (service_id 11c0774b…, Mensualitat
-- de 8) queda coberta: el seu paquet neix marcat a l'update de sobre.

alter table public.subscriptions
  drop constraint if exists subscriptions_only_group;

comment on column public.subscriptions.service_type is
  'Tipus del paquet subscrit, congelat a l''alta. Des de la 0086 ja no està limitat a grupo_reducido: mana la casella subscription_only del paquet.';
