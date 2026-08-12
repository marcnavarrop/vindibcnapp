-- ============================================================================
-- VindiBCN · 0048 — Vals de regal ("Regala Vindi")
--
-- Un client compra un paquet de sessions per regalar-lo. Es genera un codi i un
-- PDF, i qui el rebi el bescanvia per un bo a nom seu.
--
-- DIFERÈNCIA IMPORTANT AMB ELS BONS: un bo pendent de pagament ja es pot fer
-- servir per reservar, perquè qui el farà servir és qui l'ha comprat i el
-- centre el té localitzat. Aquí no: qui bescanvia pot ser un desconegut sense
-- cap relació amb el pagament. Per això un val NO és bescanviable fins que
-- l'admin confirma que s'ha cobrat ('pending_payment' → 'active').
-- ============================================================================

-- ─── Configuració del centre ────────────────────────────────────────────────

alter table public.center_settings
  add column if not exists gift_voucher_expiry_months integer not null default 12,
  add column if not exists gift_vouchers_enabled      boolean not null default true;

comment on column public.center_settings.gift_voucher_expiry_months is
  'Mesos de validesa d''un val des de la compra. Canviar-ho NO afecta els vals ja venuts: cadascun porta la seva data.';
comment on column public.center_settings.gift_vouchers_enabled is
  'Es poden VENDRE vals nous. Els ja venuts es continuen podent bescanviar encara que estigui desactivat.';

-- ─── Estats ─────────────────────────────────────────────────────────────────

do $$
begin
  if not exists (select 1 from pg_type where typname = 'gift_voucher_status') then
    create type public.gift_voucher_status as enum (
      'pending_payment', -- comprat, encara no cobrat: NO bescanviable
      'active',          -- cobrat pel centre: ja es pot bescanviar
      'redeemed',        -- bescanviat, amb el bo que en va sortir
      'expired',         -- se li ha passat la data sense bescanviar-lo
      'cancelled'        -- anul·lat manualment per l'admin
    );
  end if;
end
$$;

-- ─── Taula ──────────────────────────────────────────────────────────────────

create table if not exists public.gift_vouchers (
  id                   uuid primary key default gen_random_uuid(),
  code                 text not null unique,
  service_id           uuid not null references public.services (id) on delete restrict,
  buyer_client_id      uuid not null references public.clients (id) on delete cascade,

  -- Decoratius: surten al PDF però no restringeixen qui el pot bescanviar.
  -- Un regal es pot acabar donant a algú altre, i el codi és el que mana.
  recipient_name       text,
  recipient_email      text,
  message              text check (length(btrim(coalesce(message, ''))) <= 500),

  -- Fotografia del preu i del paquet en el moment de la compra. Si demà el
  -- centre apuja la tarifa o canvia les sessions del paquet, aquest val
  -- segueix valent el que es va pagar.
  price                numeric(10,2) not null check (price >= 0),
  service_type         public.service_type not null,
  total_sessions       integer not null check (total_sessions > 0),
  package_name         text not null,

  purchased_at         timestamptz not null default now(),
  expires_at           date not null,
  status               public.gift_voucher_status not null default 'pending_payment',

  redeemed_at          timestamptz,
  redeemed_by_client_id uuid references public.clients (id) on delete set null,
  redeemed_bono_id     uuid references public.bonos (id) on delete set null,

  pdf_path             text,
  created_at           timestamptz not null default now(),

  -- Un val bescanviat ha de dir per qui i amb quin bo. Sense això, un
  -- 'redeemed' sense rastre passaria desapercebut.
  constraint gift_vouchers_redeemed_complete check (
    status <> 'redeemed'
    or (redeemed_at is not null and redeemed_by_client_id is not null)
  )
);

comment on table public.gift_vouchers is
  'Vals de regal. Només bescanviables en estat ''active'' (= l''admin ha confirmat el cobrament).';
comment on column public.gift_vouchers.code is
  'Codi que es dona a qui rep el regal: VINDI-XXXX-XXXX, sense caràcters ambigus (O/0, I/1).';
comment on column public.gift_vouchers.pdf_path is
  'Ruta al bucket privat gift-vouchers ({buyer_client_id}/{voucher_id}.pdf).';

create index if not exists gift_vouchers_buyer_idx
  on public.gift_vouchers (buyer_client_id, created_at desc);
create index if not exists gift_vouchers_status_idx
  on public.gift_vouchers (status, created_at desc);
-- La cerca del canvi va pel codi en majúscules; l'índex de la unique ja hi serveix.

-- ─── Enllaç des del bo ──────────────────────────────────────────────────────
-- D'on ve un bo. Null = compra normal. No es fa unique perquè la relació ja
-- queda garantida per l'altre costat (un val només es bescanvia un cop).
alter table public.bonos
  add column if not exists gift_voucher_id uuid
    references public.gift_vouchers (id) on delete set null;

comment on column public.bonos.gift_voucher_id is
  'Val de regal del qual surt aquest bo. Null = comprat directament pel client.';

-- ─── RLS ────────────────────────────────────────────────────────────────────
alter table public.gift_vouchers enable row level security;

-- SELECT: l'admin ho veu tot; el client, els que ha comprat o bescanviat.
-- Un client NO pot llistar vals d'altri ni buscar codis: la validació del
-- canvi la fa el servidor amb el client de servei, mai la RLS.
drop policy if exists "gift_vouchers_select" on public.gift_vouchers;
create policy "gift_vouchers_select" on public.gift_vouchers
  for select to authenticated
  using (
    public.is_admin()
    or public.owns_client(buyer_client_id)
    or (redeemed_by_client_id is not null and public.owns_client(redeemed_by_client_id))
  );

-- INSERT: l'admin, o el propi client comprant a nom seu. El `with check` sobre
-- buyer_client_id és el que impedeix comprar en nom d'un altre; que el codi hi
-- posi el client correcte no n'hi hauria prou, perquè la RLS també protegeix
-- l'accés directe a l'API.
--
-- A la pràctica la compra passa pel servidor amb el client de servei (el preu
-- i les sessions surten del catàleg, no del navegador), però la política hi és
-- com a segona barrera.
drop policy if exists "gift_vouchers_insert" on public.gift_vouchers;
create policy "gift_vouchers_insert" on public.gift_vouchers
  for insert to authenticated
  with check (public.is_admin() or public.owns_client(buyer_client_id));

-- UPDATE: NOMÉS l'admin. Marcar un val com a pagat és la porta que el fa
-- bescanviable; si el comprador la pogués tocar, la decisió de fons d'aquesta
-- funcionalitat quedaria sense efecte. El canvi també l'escriu el servidor amb
-- el client de servei, després de validar el codi.
drop policy if exists "gift_vouchers_admin_update" on public.gift_vouchers;
create policy "gift_vouchers_admin_update" on public.gift_vouchers
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "gift_vouchers_admin_delete" on public.gift_vouchers;
create policy "gift_vouchers_admin_delete" on public.gift_vouchers
  for delete to authenticated
  using (public.is_admin());

-- ─── Bucket privat per als PDF ──────────────────────────────────────────────
-- Mateix criteri que settlement-invoices i client-documents: privat sempre, i
-- l'accés es dona amb una signed URL de vida curta generada al servidor només
-- després de comprovar qui la demana.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'gift-vouchers',
  'gift-vouchers',
  false,
  5242880, -- 5 MB: un val d'una pàgina no s'hi acosta
  array['application/pdf']
)
on conflict (id) do nothing;

-- Convenció de ruta: {buyer_client_id}/{voucher_id}.pdf, perquè la política
-- pugui decidir amb split_part(name, '/', 1) sense consultar cap taula.
drop policy if exists "storage_gift_vouchers_select" on storage.objects;
create policy "storage_gift_vouchers_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'gift-vouchers'
    and (
      public.is_admin()
      -- Es compara com a TEXT i no amb un cast a uuid: un nom de fitxer que no
      -- comencés per un uuid faria petar el cast i, amb ell, la política.
      or exists (
        select 1 from public.clients c
        where c.profile_id = auth.uid()
          and c.id::text = split_part(name, '/', 1)
      )
    )
  );

drop policy if exists "storage_gift_vouchers_write" on storage.objects;
create policy "storage_gift_vouchers_write"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'gift-vouchers' and public.is_admin());

drop policy if exists "storage_gift_vouchers_update" on storage.objects;
create policy "storage_gift_vouchers_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'gift-vouchers' and public.is_admin())
  with check (bucket_id = 'gift-vouchers' and public.is_admin());

drop policy if exists "storage_gift_vouchers_delete" on storage.objects;
create policy "storage_gift_vouchers_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'gift-vouchers' and public.is_admin());

-- ─── Avís al comprador quan li bescanvien el regal ──────────────────────────
-- Activat per defecte: qui ha pagat un regal vol saber que ha arribat.
alter table public.notification_preferences
  add column if not exists gift_voucher_redeemed_email    boolean not null default true,
  add column if not exists gift_voucher_redeemed_whatsapp boolean not null default false;
