-- ============================================================================
-- VindiBCN · 0122 — Referits: que la baja RGPD d'un client pugui acabar
--
-- QUÈ PASSAVA
--
-- `referral_rewards` (0033) i `clients.referred_by_client_id` apunten a
-- `clients` SENSE `on delete`. Si el client que es dona de baixa té alguna
-- recompensa de «Porta un amic», o algú es va registrar amb el seu codi,
-- esborrar-li el compte (auth.users → profiles → clients, en cascada) fallava
-- amb 23503. I la baixa quedava a mitges: l'app ja n'havia esborrat els
-- documents i les sessions de prova (i, des de la 0119, arxivat l'historial).
--
-- QUÈ FA
--
--   · La recompensa DEL client que plega (n'és el beneficiari): s'esborra amb
--     ell (`on delete cascade`). És seva i no la gastarà ningú.
--   · La recompensa d'UN ALTRE en què ell surt com a padrí o com a referit: es
--     queda (és un descompte que l'altre pot gastar), sense el nom de qui ha
--     plegat (`on delete set null`). Per això `referrer_client_id` i
--     `referee_client_id` passen a admetre NULL. A /admin/referits hi surt «—».
--   · El bo on es va gastar una recompensa (`used_in_bono_id`): si el bo
--     desapareix, la recompensa ho recorda com a gastada, sense el bo.
--   · Qui es va registrar amb el seu codi (`clients.referred_by_client_id`): es
--     queda client, sense padrí.
--
-- Els NOMS de les claus foranes no canvien: l'app els fa servir per llegir els
-- noms a /admin/referits (`referral_rewards_referrer_client_id_fkey`…).
--
-- Idempotent: `drop constraint if exists` i tornar-la a crear.
-- ============================================================================

alter table public.referral_rewards alter column referrer_client_id drop not null;
alter table public.referral_rewards alter column referee_client_id  drop not null;

alter table public.referral_rewards drop constraint if exists referral_rewards_referrer_client_id_fkey;
alter table public.referral_rewards add constraint referral_rewards_referrer_client_id_fkey
  foreign key (referrer_client_id) references public.clients (id) on delete set null;

alter table public.referral_rewards drop constraint if exists referral_rewards_referee_client_id_fkey;
alter table public.referral_rewards add constraint referral_rewards_referee_client_id_fkey
  foreign key (referee_client_id) references public.clients (id) on delete set null;

alter table public.referral_rewards drop constraint if exists referral_rewards_beneficiary_client_id_fkey;
alter table public.referral_rewards add constraint referral_rewards_beneficiary_client_id_fkey
  foreign key (beneficiary_client_id) references public.clients (id) on delete cascade;

alter table public.referral_rewards drop constraint if exists referral_rewards_used_in_bono_id_fkey;
alter table public.referral_rewards add constraint referral_rewards_used_in_bono_id_fkey
  foreign key (used_in_bono_id) references public.bonos (id) on delete set null;

alter table public.clients drop constraint if exists clients_referred_by_client_id_fkey;
alter table public.clients add constraint clients_referred_by_client_id_fkey
  foreign key (referred_by_client_id) references public.clients (id) on delete set null;

comment on column public.referral_rewards.referrer_client_id is
  'Qui va recomanar. NULL si s''ha donat de baixa (0122).';
comment on column public.referral_rewards.referee_client_id is
  'Qui es va registrar amb el codi. NULL si s''ha donat de baixa (0122).';
