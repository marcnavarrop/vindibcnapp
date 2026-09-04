-- ============================================================================
-- VindiBCN · 0071 — Els trams del bonus, un joc per freqüència
--
-- Un període biennal acumula aproximadament el doble de volum que un d'anual,
-- així que aplicar-hi la mateixa taula de trams no és just: qui cobra cada dos
-- anys arriba als trams alts pel simple fet que el període és més llarg, no
-- perquè hagi treballat més per any.
--
-- A partir d'aquí hi ha DOS jocs de trams independents, un per a cada valor de
-- `bonus_payout_frequency`. Cada joc manté la seva pròpia vigència.
--
-- CONTEXT: quan s'escriu això el sistema de bonus és BUIT a producció —cap
-- tram, cap pes, cap configuració de treballador i cap payout—. No hi ha cap
-- pagament real que aquest canvi pugui alterar ni cap decisió de reompliment
-- retroactiu que prendre.
-- ============================================================================

-- ─── Els trams ──────────────────────────────────────────────────────────────
--
-- El `default` és transitori i es retira tot seguit. Hi és perquè un
-- `add column not null` necessita un valor per a les files que hi hagi (a
-- producció no n'hi ha cap; en local sí que en podria haver-hi, i que caiguin
-- com a anuals és el que es vol). Un cop posades, es treu: així cap `insert`
-- futur pot oblidar-se la freqüència i acabar en 'annual' sense que ningú se
-- n'assabenti. En un sistema que decideix pagaments, val més que peti.
alter table public.bonus_tiers
  add column if not exists frequency public.bonus_payout_frequency not null default 'annual';

alter table public.bonus_tiers alter column frequency drop default;

comment on column public.bonus_tiers.frequency is
  'A quina freqüència de tancament s''aplica aquest tram. Els dos jocs són independents i cadascun manté la seva pròpia vigència (effective_from/until).';

-- Ara tota lectura filtra primer per freqüència, així que va al davant.
drop index if exists public.bonus_tiers_lookup;
create index if not exists bonus_tiers_lookup
  on public.bonus_tiers (frequency, effective_from desc, min_units);

-- ─── Els payouts ja tancats ─────────────────────────────────────────────────
--
-- L'import no en depèn: `tier_breakdown` va congelat i un payout tancat no
-- torna a mirar `bonus_tiers` mai més. Això és per poder RESPONDRE la pregunta
-- "d'on van sortir aquestes tarifes" d'aquí a un any, quan els dos jocs hagin
-- canviat diverses vegades. Sense la columna, el desglosament és correcte però
-- orfe: no diu de quina taula venia.
alter table public.bonus_payouts
  add column if not exists frequency public.bonus_payout_frequency not null default 'annual';

alter table public.bonus_payouts alter column frequency drop default;

comment on column public.bonus_payouts.frequency is
  'Freqüència amb què es va tancar aquest període, i per tant quin joc de trams es va aplicar. Informativa: l''import ja va congelat a tier_breakdown.';

-- NOTA sobre l'índex únic `bonus_payouts_unique_period` (0040): no es toca i no
-- li cal. Segueix sent (trainer_id, period_start, period_end), i la freqüència
-- no hi entra a posta —un mateix professional no ha de poder tancar dos cops el
-- mateix període ni canviant de freqüència—.
