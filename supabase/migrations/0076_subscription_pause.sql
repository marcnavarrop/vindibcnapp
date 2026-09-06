-- ============================================================================
-- VindiBCN · 0076 — Congelar una subscripció: les dates i les regles
--
-- Segona meitat de la pausa. La 0075 va afegir el valor 'paused' a l'enum i
-- HA D'HAVER ACABAT abans que això corri: els CHECK de sota el fan servir, i
-- Postgres no deixa usar un valor d'enum dins de la mateixa transacció que
-- l'afegeix.
--
-- LES QUATRE DECISIONS QUE L'ORDENEN
--
-- 1. `next_renewal_on` NO es buida. Guarda la data CONGELADA, i reprendre li
--    suma els dies que ha estat aturada. Buidar-la hauria obligat a relaxar
--    `subscriptions_renewal_matches_status` i, sobretot, hauria perdut l'única
--    dada amb què es pot calcular el desplaçament. Que el client no vegi cap
--    compte enrere mentre està pausada és cosa de la pantalla, no de la
--    columna: la data hi és, però no corre.
--
-- 2. AMB TARGETA, LA PAUSA EXIGEIX DATA DE REPRESA. A Stripe una subscripció
--    es congela movent-li el `trial_end`, que és l'única manera en API estable
--    de dir "la propera factura, exactament aquest dia" —`pause_collection` no
--    atura el rellotge i el `pause` natiu demana una versió d'API preview i el
--    flexible billing mode—. I `trial_end` admet com a molt DOS ANYS. Una pausa
--    indefinida amb targeta seria, doncs, una bomba de rellotgeria que cobraria
--    sola d'aquí a dos anys. Al centre no hi ha cap Stripe pel mig, i allà sí
--    que es pot deixar indefinida.
--
-- 3. NO ES POT PAUSAR UNA 'past_due'. Un mes a deure es cobra o es cancel·la;
--    congelar-lo esborraria el rastre de l'impagament i deixaria el deute
--    surant sense estat que el digui. Això NO ho pot garantir un check —mira
--    l'estat d'abans, no el d'ara— i es tanca a l'acció de l'admin.
--
-- 4. `paused_at` hi és EXACTAMENT mentre està pausada. És la base del càlcul
--    del desplaçament, i una fila amb estat 'paused' i sense marca de temps
--    seria una subscripció que no es pot reprendre.
-- ============================================================================

alter table public.subscriptions
  add column if not exists paused_at timestamptz,
  add column if not exists resume_on date;

comment on column public.subscriptions.paused_at is
  'Quan el centre la va congelar. És la base del càlcul: en reprendre, next_renewal_on avança tants dies com hagi estat pausada. Null si no està pausada.';
comment on column public.subscriptions.resume_on is
  'Dia previst de represa, si se''n va indicar cap. El barrido diari la reprèn sola en arribar. Null = indefinida, i aleshores només la reprèn l''admin a mà. Amb targeta és OBLIGATÒRIA: veure la capçalera.';

-- ─── Les regles ─────────────────────────────────────────────────────────────

alter table public.subscriptions
  drop constraint if exists subscriptions_paused_has_timestamp;
alter table public.subscriptions
  add constraint subscriptions_paused_has_timestamp check (
    (status = 'paused') = (paused_at is not null)
  );

alter table public.subscriptions
  drop constraint if exists subscriptions_resume_only_when_paused;
alter table public.subscriptions
  add constraint subscriptions_resume_only_when_paused check (
    resume_on is null or status = 'paused'
  );

-- La regla asimètrica de la decisió 2. A la base i no només al codi: una pausa
-- de targeta sense data és, literalment, un cobrament que tornarà sol d'aquí a
-- dos anys quan a Stripe se li acabi el `trial_end`.
alter table public.subscriptions
  drop constraint if exists subscriptions_card_pause_needs_date;
alter table public.subscriptions
  add constraint subscriptions_card_pause_needs_date check (
    not (status = 'paused' and payment_method = 'card' and resume_on is null)
  );

-- ─── El barrido de represa ──────────────────────────────────────────────────
--
-- Les que tenen data i ja els toca. Parcial, com la de la 0074: si la pausa
-- s'usa poc, l'índex només conté les poques files que hi participen.
create index if not exists subscriptions_resume_sweep
  on public.subscriptions (resume_on)
  where status = 'paused' and resume_on is not null;

-- ─── Avisos ─────────────────────────────────────────────────────────────────
--
-- Actius per defecte, com els altres tres. Al client li congelen —o li
-- descongelen— un servei que paga, i sense dir-l'hi es trobaria la subscripció
-- canviada d'estat sense saber per què. La decisió és del centre; el silenci
-- no ho ha de ser.
alter table public.notification_preferences
  add column if not exists subscription_paused_email  boolean not null default true,
  add column if not exists subscription_resumed_email boolean not null default true;
