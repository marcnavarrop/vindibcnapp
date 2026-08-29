-- ============================================================================
-- VindiBCN · 0054 — Pagament amb targeta: la idempotència, a la base
--
-- Amb Stripe Checkout el bo i el val NO es creen quan es prem el botó, sinó
-- quan Stripe confirma el cobrament amb un webhook. I Stripe avisa clarament
-- que un mateix esdeveniment es pot lliurar més d'un cop: si la resposta triga,
-- si la xarxa falla, o simplement perquè el seu sistema reintenta. Comprovar-ho
-- al codi ("existeix ja un bo per aquesta sessió?") té el mateix forat que
-- teníem amb l'aforament dels grups: entre el SELECT i l'INSERT no hi ha res, i
-- dos lliuraments simultanis del mateix esdeveniment passarien tots dos.
--
-- Així que la garantia se'n va a la base, com allà: un índex ÚNIC sobre
-- l'identificador de la sessió de Checkout. Dos intents de crear el bo de la
-- mateixa sessió i el segon rebota amb un 23505 que el webhook llegeix com
-- "això ja estava fet" i respon 200 perquè Stripe deixi de reintentar-ho.
--
-- L'índex és PARCIAL (`where ... is not null`): els bons i els vals pagats al
-- centre no tenen sessió de Checkout, i en un únic normal tots els NULL serien
-- iguals entre ells. A Postgres els NULL no xoquen mai en un índex únic, però
-- el `where` a més estalvia indexar les files que no hi participen, que ara
-- mateix són totes les existents.
-- ============================================================================

alter table public.bonos
  add column if not exists stripe_checkout_session_id text;

comment on column public.bonos.stripe_checkout_session_id is
  'Sessió de Stripe Checkout que va pagar aquest bo. NULL si es va pagar al centre. Únic: evita duplicar el bo si el webhook arriba dos cops.';

create unique index if not exists bonos_stripe_session_uidx
  on public.bonos (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

alter table public.gift_vouchers
  add column if not exists stripe_checkout_session_id text;

comment on column public.gift_vouchers.stripe_checkout_session_id is
  'Sessió de Stripe Checkout que va pagar aquest val. NULL si es va pagar al centre. Únic: evita duplicar el val si el webhook arriba dos cops.';

create unique index if not exists gift_vouchers_stripe_session_uidx
  on public.gift_vouchers (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

-- ─── El cobrament tampoc es pot duplicar ────────────────────────────────────
--
-- Complir una compra són diverses escriptures: el bo (o el val), el cobrament a
-- `payments` i, en el cas dels bons, la recompensa de referit. Si la primera
-- passa i la segona peta, el webhook respon 500 i Stripe reintenta —que és el
-- que volem—, però al reintent la primera ja no es pot repetir i abans de tenir
-- això el compliment es donava per fet i el cobrament no s'arribava a anotar
-- mai: diners a Stripe i cap fila a `payments`.
--
-- Amb aquest índex, cada pas del compliment es pot repetir sense por i el
-- reintent acaba de fer el que faltava. Un PaymentIntent és una compra i només
-- una, així que la unicitat és certa i no un truc.
create unique index if not exists payments_stripe_payment_uidx
  on public.payments (stripe_payment_id)
  where stripe_payment_id is not null;

comment on column public.payments.stripe_payment_id is
  'PaymentIntent de Stripe que va cobrar això. Únic: fa que anotar el cobrament es pugui reintentar sense duplicar-lo.';
