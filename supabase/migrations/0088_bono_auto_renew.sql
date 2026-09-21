-- ============================================================================
-- VindiBCN · 0088 — Renovació automàtica d'un bo quan s'esgota
--
-- La decisió: quan un bo arriba a 0 sessions, si el client ho ha demanat, en
-- neix un de NOU pendent de pagament del mateix paquet i se l'avisa per correu.
-- No és cap cobrament automàtic: no hi ha targeta desada ni càrrec fora de
-- sessió. El bo nou espera que el client hi entri i el pagui.
--
-- PER QUÈ CAL `service_id`, SI EL BO JA ÉS UNA FOTOGRAFIA
--
-- Un bo ja guarda `service_type`, `total_sessions` i `price`: amb això sol ja
-- es podria copiar. El `service_id` no fa falta per COPIAR, fa falta per
-- DECIDIR si s'ha de copiar: que el paquet segueixi al catàleg, que no s'hagi
-- convertit en «només per subscripció» (0086) i, amb el Checkout que adopta un
-- bo pendent, per obrir-ne la sessió de pagament.
--
-- És el mateix raonament que la 0072 va escriure per a `subscriptions`, que
-- guarda les DUES coses —`service_id` i la fotografia— perquè «amb només el
-- service_id, renovar dependria que el catàleg segueixi igual dotze mesos».
-- Aquí la fotografia ja hi era; només faltava la referència.
--
-- SENSE BACK-FILL, I A POSTA
--
-- Els bons històrics es queden amb `service_id` null. No sabem de quin paquet
-- van sortir —`bonos` mai ho ha guardat— i endevinar-ho pel tipus i el nombre
-- de sessions seria inventar-s'ho. Un bo sense `service_id` no pot optar a
-- auto-renovació, i la constraint de més avall ho fa impossible en comptes de
-- deixar-ho a la bona fe del codi.
--
-- EL CINQUÈ EMISSOR ES QUEDA A NULL, I NO ÉS CAP OBLIT
--
-- `claim_subscription_extra` (0073) insereix el bo de la sessió extra des de
-- SQL, dins del seu advisory lock. No se li posa `service_id`: un extra neix
-- amb `is_subscription_extra = true`, pertany a una subscripció i per la
-- constraint de sota no podrà auto-renovar-se mai. Tocar una funció amb pany
-- per una columna que ningú llegirà seria risc sense premi.
-- ============================================================================

alter table public.bonos
  add column if not exists service_id uuid
    references public.services (id) on delete set null,
  add column if not exists auto_renew boolean not null default false,
  add column if not exists renewed_from_bono_id uuid
    references public.bonos (id) on delete set null;

comment on column public.bonos.service_id is
  'Paquet del catàleg del qual va sortir aquest bo. Null als bons anteriors a la 0088 i als extres de subscripció, que no es renoven mai. ON DELETE SET NULL i no RESTRICT: un bo ja venut ha de sobreviure que el centre retiri el paquet —la fotografia (tipus, sessions, preu) ja és a la fila—, encara que llavors perdi el dret a auto-renovar-se.';

comment on column public.bonos.auto_renew is
  'El client ha demanat que en neixi un de nou quan aquest arribi a 0. L''activa ELL, a la compra o des de «Els meus bons»: és un compromís de despesa i no el pot contraure ni l''admin ni el professional des de l''alta manual.';

comment on column public.bonos.renewed_from_bono_id is
  'Bo esgotat que ha fet néixer aquest. Serveix per a dues coses: saber d''on ve cada renovació i, amb l''índex únic de sota, que no en neixin dues.';

-- ─── Idempotència, donada per la base i no pel codi ──────────────────────────
--
-- Cinc camins poden deixar un bo a 0 (les dues funcions de reserva, l'alta
-- manual, l'autoservei del client i la promoció de la llista d'espera). Si dos
-- hi arribessin alhora, el recompte no ho impediria: entre mirar i inserir no
-- hi ha res. Mateix criteri que l'aforament dels grups (0053) i que el webhook
-- de Stripe (0054): el segon intent rebota amb un 23505 que es llegeix com "ja
-- estava fet".
create unique index if not exists bonos_renewed_from_unique
  on public.bonos (renewed_from_bono_id)
  where renewed_from_bono_id is not null;

-- ─── Dues coses que no poden ser certes alhora ───────────────────────────────

-- Un bo que no sap de quin paquet ve no es pot renovar. Sense això, un bo
-- històric marcat per renovar es quedaria esperant una renovació impossible i
-- el client no sabria mai per què no arriba.
alter table public.bonos
  drop constraint if exists bonos_auto_renew_needs_service;
alter table public.bonos
  add constraint bonos_auto_renew_needs_service check (
    auto_renew = false or service_id is not null
  );

-- Un bo emès per una subscripció ja es renova sol cada mes: marcar-lo també
-- per auto-renovació n'emetria dos per dues vies.
--
-- Això tanca la meitat de la regla. L'altra meitat —que un client amb
-- subscripció VIVA d'aquest servei no pugui activar l'interruptor en un bo
-- comprat solt— no es pot expressar en un check de fila i la comprova
-- l'aplicació abans de desar.
alter table public.bonos
  drop constraint if exists bonos_auto_renew_not_subscription;
alter table public.bonos
  add constraint bonos_auto_renew_not_subscription check (
    auto_renew = false or subscription_id is null
  );

-- Buscar els bons esgotats amb renovació demanada ha de ser barat: és el que
-- mirarà el disparador a cada reserva que deixi un bo a zero.
create index if not exists bonos_auto_renew_idx
  on public.bonos (client_id, service_id)
  where auto_renew = true;
