-- ============================================================================
-- VindiBCN · 0089 — Quan va mirar els seus exercicis cada client
--
-- Al menú del client, al costat d'«Exercicis», hi ha d'anar una piloteta amb
-- el que se li ha assignat i encara no ha mirat. La meitat de la feina ja hi
-- era: `client_exercises` (0012) desa `assigned_at`. El que no hi havia era
-- cap rastre que el client ho hagués obert.
--
-- Avui aquest buit es tapa a mà: hi ha un botó que envia un correu de
-- "tens exercicis nous". L'avís, doncs, depèn que algú se'n recordi, i viu
-- fora de l'app.
--
-- UNA FILA PER CLIENT, NO UNA PER EXERCICI
--
-- Mateixa forma que `community_seen` (0087) i per la mateixa raó: el marcatge
-- és «en entrar a la pantalla, tot vist», de manera que una taula de
-- (client × exercici) guardaria N files per dir exactament el que diu una
-- data. El dia que calgui marcar exercici a exercici, aquesta data es
-- converteix en el tall inicial i la taula fina es construeix a sobre.
--
-- PERÒ AQUÍ SÍ QUE CAL SEMBRAR, I A LA 0087 NO
--
-- Aquesta és l'única diferència de criteri, i val la pena escriure-la.
--
-- A comunitat, un client sense fila té com a tall la seva ALTA, i funciona
-- perquè els anuncis del centre són ANTERIORS a l'alta dels clients: ningú es
-- troba l'històric encès el primer dia. Els exercicis assignats, en canvi,
-- són per definició POSTERIORS a l'alta del client —primer entra, després
-- el seu professional li assigna feina—. Amb el mateix tall, el dia del
-- desplegament TOTS els clients estrenarien la piloteta amb la seva
-- biblioteca sencera a dins, que és justament el que la 0087 evitava.
--
-- Per això la taula neix sembrada amb `now()` per a qui ja hi és: tothom
-- comença a zero i només compta el que s'assigni a partir d'ara.
--
-- I els clients NOUS segueixen sense fila, a posta: per a ells `created_at`
-- sí que és el tall bo, perquè encara no tenen cap exercici assignat i
-- qualsevol que els arribi serà, de veritat, nou.
-- ============================================================================

create table public.exercises_seen (
  client_id uuid primary key references public.clients (id) on delete cascade,
  seen_at   timestamptz not null default now()
);

-- La sembra. `on conflict do nothing` perquè tornar a executar la migració
-- no hagi de moure cap marcador enrere ni endavant.
insert into public.exercises_seen (client_id, seen_at)
select id, now() from public.clients
on conflict (client_id) do nothing;

-- ─── RLS ─────────────────────────────────────────────────────────────────────
alter table public.exercises_seen enable row level security;

-- Cadascú la seva. L'admin les veu totes: el dia que un client digui «no em
-- surt cap exercici nou», poder mirar quan hi va entrar per últim cop
-- estalvia endevinar. Igual que a la 0087.
--
-- El PROFESSIONAL no hi entra, i és deliberat. Ell assigna els exercicis
-- (`client_exercises_write`, 0012), però quan el client els ha obert és una
-- dada de seguiment de la persona, no de la feina: qui la necessita per donar
-- suport és l'administració. Si algun dia cal, afegir-l'hi és una línia.
create policy "exercises_seen_select"
  on public.exercises_seen for select
  using (
    public.is_admin()
    or public.owns_client(client_id)
  );

-- L'alta i l'actualització van SEPARADES i les dues comproven `owns_client`.
--
-- No és burocràcia: el marcatge és un UPSERT, i un upsert necessita les dues
-- polítiques. Amb només la d'INSERT, la primera visita del client funcionaria
-- i la segona fallaria en silenci —la fila ja hi seria— i la piloteta no
-- s'apagaria mai més sense que res es queixés. És el parany que la 0087 ja va
-- documentar, i amb la sembra de més amunt TOTS els clients d'avui ja tenen
-- fila: aquí el camí d'UPDATE és el normal des del primer dia, no l'excepció.
create policy "exercises_seen_insert"
  on public.exercises_seen for insert
  with check (public.owns_client(client_id));

-- I l'UPDATE porta `using` a més del `with check`: sense el `using`, la
-- comprovació només miraria la fila NOVA, i un client podria moure el
-- marcador d'un altre passant-li el seu propi `client_id` al valor final.
create policy "exercises_seen_update"
  on public.exercises_seen for update
  using (public.owns_client(client_id))
  with check (public.owns_client(client_id));

-- Sense política de DELETE a posta: ningú necessita esborrar un marcador, i
-- aquí només es concedeix el que es fa servir.
