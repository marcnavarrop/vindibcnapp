-- ============================================================================
-- VindiBCN · 0082 — Una reserva dura, i dues que es trepitgen ja no hi caben
--
-- EL FORAT QUE ES TAPA
--
-- Des de la 0007, la garantia de "un professional, una sessió alhora" era un
-- índex únic sobre (trainer_id, scheduled_at). Això només és cert mentre TOTES
-- les hores d'inici caiguin en punt: dues sessions d'una hora que comencen a
-- les 9:00 i a les 9:30 tenen `scheduled_at` DIFERENT, i l'índex únic les deixa
-- passar totes dues. Se solapen mitja hora i ningú se n'assabenta.
--
-- Avui no hi ha cap fila així en producció (comprovat: zero files amb minuts
-- diferents de zero), o sigui que el forat és LATENT. Però la rejilla de mitja
-- hora que ve a continuació el convertiria en el cas normal, i abans d'obrir
-- aquella porta cal que la garantia sigui de veritat.
--
-- QUÈ CANVIA
--
-- 1. Una reserva passa a DIR quant dura. Fins ara la durada no existia enlloc:
--    les sessions duraven una hora perquè la rejilla era d'una hora, no perquè
--    cap taula ho digués. `SESSION_DURATION_MINUTES` vivia a
--    `lib/calendar-links.ts` i només servia per generar l'esdeveniment .ics.
--
-- 2. L'índex únic deixa pas a una constraint EXCLUDE amb GiST sobre el RANG
--    [scheduled_at, ends_at). Deixa de comparar instants i passa a comparar
--    intervals, que és el que de debò vol dir "ocupat".
--
-- PER QUÈ UNA COLUMNA `ends_at` I NO L'ARITMÈTICA DIRECTA
--
-- El natural seria `tstzrange(scheduled_at, scheduled_at + make_interval(...))`
-- dins de la constraint. Postgres ho rebutja:
--
--     ERROR:  functions in index expression must be marked IMMUTABLE
--
-- L'operador `timestamptz + interval` és STABLE, no IMMUTABLE: sumar un
-- interval amb dies o mesos depèn de la zona horària (un dia pot tenir 23 o 25
-- hores). Encara que aquí l'interval només porti minuts —i llavors sí que és
-- independent de la zona—, Postgres marca l'operador sencer com a STABLE i no
-- el deixa entrar en una expressió d'índex.
--
-- Hi havia dues sortides. Una: embolicar-ho en una funció declarada IMMUTABLE
-- a mà. Funciona, però és mentir-li al planificador, i el dia que algú hi passi
-- un interval amb dies l'índex queda silenciosament corrupte. L'altra —la que
-- es fa aquí— és desar el final com a columna i que `tstzrange(a, b)`, que SÍ
-- és immutable, el llegeixi. Costa una columna i un trigger, i a canvi no hi ha
-- cap asterisc.
--
-- La columna no se la creu ningú de fora: el trigger la recalcula SEMPRE, tant
-- a l'INSERT com a l'UPDATE. L'aplicació no la pot escriure malament perquè
-- l'aplicació no la escriu.
--
-- De propina, `ends_at` fa que la consulta de solapament de l'aplicació sigui
-- un `scheduled_at < fi AND ends_at > inici` indexable, en comptes d'aritmètica
-- per cada fila.
--
-- EL RANG ÉS SEMIOBERT [inici, fi)
--
-- Una sessió de 9:00 a 10:00 i una altra de 10:00 a 11:00 NO es solapen: són
-- consecutives, que és exactament com treballa el centre. `'[)'` ho diu.
--
-- QUÈ SEGUEIX FORA D'AQUESTA CONSTRAINT, I A PROPÒSIT
--
-- Els grups. Quatre files legítimes a la mateixa franja són quatre files, i cap
-- constraint d'exclusió sap dir "com a molt quatre". L'aforament dels grups és
-- de la 0053/0070 i es refà a la 0083, que és on viu aquest problema.
--
-- I les files amb `trainer_id` nul. Una constraint d'exclusió no es viola quan
-- un dels operadors torna null, així que dues reserves sense professional
-- assignat no es bloquegen entre elles — mateix comportament que tenia l'índex
-- únic de la 0007, on els nuls també eren tots diferents.
-- ============================================================================

-- `btree_gist` és el que permet barrejar una igualtat normal (`trainer_id`) amb
-- un operador de rang (`&&`) dins del mateix índex GiST.
create extension if not exists btree_gist;

-- ─── 1. La durada ───────────────────────────────────────────────────────────
--
-- 60 minuts per a tot el catàleg, que és el que fa el centre avui i el que ja
-- assumia tota l'aplicació sense dir-ho. No es fa configurable per servei a
-- posta: mentre no hi hagi un servei que duri una altra cosa, una columna amb
-- un sol valor possible és més honesta que una pantalla d'ajustos que ningú
-- toca. El dia que calgui, el lloc per mirar ja existeix.
alter table public.reservations
  add column if not exists duration_minutes integer not null default 60;

alter table public.reservations
  drop constraint if exists reservations_duration_positive;
alter table public.reservations
  add constraint reservations_duration_positive
  check (duration_minutes > 0 and duration_minutes <= 24 * 60);

comment on column public.reservations.duration_minutes is
  'Durada de la sessió en minuts. Avui sempre 60. Defineix, amb scheduled_at, el rang que ocupa la franja.';

-- ─── 2. El final, derivat i intocable ───────────────────────────────────────
alter table public.reservations
  add column if not exists ends_at timestamptz;

create or replace function public.reservations_set_ends_at()
returns trigger
language plpgsql
as $$
begin
  -- Es recalcula sempre i s'ignora el que hagi arribat de fora. `ends_at` no és
  -- un camp que s'ompli: és una conseqüència.
  new.ends_at := new.scheduled_at + make_interval(mins => new.duration_minutes);
  return new;
end;
$$;

drop trigger if exists trg_reservations_ends_at on public.reservations;
create trigger trg_reservations_ends_at
  before insert or update of scheduled_at, duration_minutes
  on public.reservations
  for each row execute function public.reservations_set_ends_at();

-- Les files que ja hi són. Totes duren 60 minuts perquè totes s'han creat sota
-- aquesta assumpció implícita.
update public.reservations
   set ends_at = scheduled_at + make_interval(mins => duration_minutes)
 where ends_at is null;

alter table public.reservations
  alter column ends_at set not null;

comment on column public.reservations.ends_at is
  'Final de la sessió (exclòs). El manté el trigger trg_reservations_ends_at a partir de scheduled_at i duration_minutes; no l''escriu mai l''aplicació.';

-- ─── 3. La garantia de debò ─────────────────────────────────────────────────
--
-- Es crea ABANS de retirar l'índex únic de la 0007: entremig hi ha les dues
-- proteccions alhora, mai cap.
alter table public.reservations
  drop constraint if exists reservations_no_overlap_non_group;
alter table public.reservations
  add constraint reservations_no_overlap_non_group
  exclude using gist (
    trainer_id with =,
    tstzrange(scheduled_at, ends_at, '[)') with &&
  )
  where (status = 'booked' and service_type <> 'grupo_reducido');

comment on constraint reservations_no_overlap_non_group on public.reservations is
  'Un professional no pot tenir dues sessions no-grup amb els horaris solapats. Substitueix uniq_reservation_slot_non_group (0007), que només comparava instants exactes i deixava passar 9:00 i 9:30.';

-- L'índex únic de la 0007 ja no aporta res: dues files amb el mateix
-- `scheduled_at` i la mateixa durada són, per definició, dos rangs que se
-- solapen, i la constraint de dalt les rebutja igual. Mantenir-lo seria una
-- segona regla dient el mateix i un índex més a mantenir a cada escriptura.
drop index if exists public.uniq_reservation_slot_non_group;

-- ─── 4. Per a les consultes de solapament de l'aplicació ────────────────────
--
-- L'índex GiST de la constraint només cobreix les no-grup. L'aplicació, quan
-- comprova si una franja està lliure, ha de mirar TAMBÉ les de grup (una sessió
-- individual no pot trepitjar un grup) i les proves. Aquest índex serveix
-- aquella consulta.
create index if not exists idx_reservations_trainer_range
  on public.reservations (trainer_id, scheduled_at, ends_at)
  where status = 'booked';
