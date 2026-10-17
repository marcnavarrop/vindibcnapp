-- ============================================================================
-- VindiBCN · 0123 — Vals de regal: el val sobreviu a la baixa de qui el va comprar
--
-- QUÈ PASSAVA
--
--   · `gift_vouchers.buyer_client_id` era `on delete cascade` (0048): si qui
--     va COMPRAR un val es donava de baixa, el val desapareixia, encara que la
--     persona que l'havia rebut no l'hagués bescanviat. Un regal pagat que
--     s'esvaïa; i el PDF quedava orfe al bucket.
--   · I a l'inrevés, un altre forat: `redeemed_by_client_id` és `on delete set
--     null`, però el check `gift_vouchers_redeemed_complete` exigia que un val
--     'redeemed' en tingués. La baixa de qui havia BESCANVIAT un val fallava
--     amb 23514, a mitges.
--
-- QUÈ FA (decisió d'en Marc, 17/10/2026)
--
--   · `buyer_client_id` admet NULL i és `on delete set null`: el val segueix
--     igual (estat, codi, caducitat), bescanviable si estava actiu, i el seu
--     PDF es queda on era. El nom de la clau no canvia (l'app el fa servir).
--   · Un val bescanviat ha de dir QUAN; QUI pot quedar buit si aquella persona
--     s'ha donat de baixa.
--
-- Idempotent: `drop constraint if exists` i tornar-la a crear.
-- ============================================================================

alter table public.gift_vouchers alter column buyer_client_id drop not null;

alter table public.gift_vouchers drop constraint if exists gift_vouchers_buyer_client_id_fkey;
alter table public.gift_vouchers add constraint gift_vouchers_buyer_client_id_fkey
  foreign key (buyer_client_id) references public.clients (id) on delete set null;

alter table public.gift_vouchers drop constraint if exists gift_vouchers_redeemed_complete;
alter table public.gift_vouchers add constraint gift_vouchers_redeemed_complete
  check (status <> 'redeemed' or redeemed_at is not null);

comment on column public.gift_vouchers.buyer_client_id is
  'Qui el va comprar. NULL si s''ha donat de baixa: el val segueix viu i bescanviable (0123).';
comment on column public.gift_vouchers.redeemed_by_client_id is
  'Qui el va bescanviar. NULL si s''ha donat de baixa (0123); el val segueix constant com a bescanviat.';
