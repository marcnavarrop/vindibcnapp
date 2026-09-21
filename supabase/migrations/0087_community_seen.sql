-- ============================================================================
-- VindiBCN · 0087 — Quan va mirar la comunitat cada client, per últim cop
--
-- Al menú del client, al costat de «Comunitat», hi ha d'anar una piloteta amb
-- el que encara no ha vist. Fins ara no hi havia manera de saber-ho: ni els
-- anuncis (0004) ni les enquestes (0031) guarden enlloc qui se les ha mirades.
--
-- UNA FILA PER CLIENT, NO UNA PER ANUNCI
--
-- El marcatge és «en entrar a la pantalla, tot vist». Amb aquesta regla, una
-- taula de (client × ítem) guardaria N files per dir exactament el que diu una
-- data: la precisió per ítem es pagaria i no es faria servir. El dia que calgui
-- marcar ítem a ítem —desplegar un anunci, tancar un avís un per un—, aquesta
-- data es converteix en el tall inicial i la taula fina es construeix a sobre
-- sense perdre res.
--
-- EL CLIENT NOU NO ARRASTRA EL PASSAT
--
-- Sense fila, el tall és `clients.created_at`. Així qui s'acaba de donar d'alta
-- no es troba una piloteta amb tot l'històric del centre, i no cal sembrar cap
-- fila en donar-lo d'alta ni fer cap back-fill ara. Avui, de fet, els tres
-- anuncis que hi ha són anteriors a l'alta de tots els clients: tots quatre
-- començaran amb el compte a zero d'anuncis.
--
-- QUÈ COMPTA I QUÈ NO
--
-- Els anuncis no caduquen (la 0004 no els va posar ni `active` ni data de fi),
-- de manera que compten tots els posteriors al tall. Les enquestes, només les
-- que encara es poden respondre: `active` i sense tancar.
--
-- Una enquesta VISTA i NO VOTADA deixa de comptar. Comptar-la fins que voti
-- convertiria la piloteta en un recordatori insistent, que és el pop-up
-- obligatori que es va descartar, només que més petit. Qui vulgui respondre-la
-- la té allà; qui no, no se li recorda cada vegada.
-- ============================================================================

create table public.community_seen (
  client_id uuid primary key references public.clients (id) on delete cascade,
  seen_at   timestamptz not null default now()
);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
alter table public.community_seen enable row level security;

-- Cadascú la seva. L'admin les veu totes: el dia que un client digui «no em
-- surt cap avís», poder mirar quan va entrar per últim cop estalvia endevinar.
create policy "community_seen_select"
  on public.community_seen for select
  using (
    public.is_admin()
    or public.owns_client(client_id)
  );

-- L'alta i l'actualització van SEPARADES i les dues comproven `owns_client`.
--
-- No és burocràcia: el marcatge és un UPSERT, i un upsert necessita les dues
-- polítiques. Amb només la d'INSERT, la primera visita del client funcionaria i
-- la segona fallaria en silenci —la fila ja hi és— i la piloteta no s'apagaria
-- mai més sense que res es queixés.
--
-- I l'UPDATE porta `using` a més del `with check`: sense el `using`, la
-- comprovació només miraria la fila NOVA, i un client podria moure el marcador
-- d'un altre passant-li el seu propi `client_id` al valor final.
create policy "community_seen_insert"
  on public.community_seen for insert
  with check (public.owns_client(client_id));

create policy "community_seen_update"
  on public.community_seen for update
  using (public.owns_client(client_id))
  with check (public.owns_client(client_id));

-- Sense política de DELETE a posta: ningú necessita esborrar un marcador, i
-- aquí només es concedeix el que es fa servir.
