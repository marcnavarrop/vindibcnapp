-- ============================================================================
-- VindiBCN · 0083 — L'aforament dels grups deixa de mirar l'instant i mira la
--                   franja sencera
--
-- CONTEXT: AQUESTA FUNCIÓ JA VA COSTAR DE DEIXAR BÉ
--
-- La 0053 la va escriure per tancar una cursa real: deu peticions simultànies
-- contra un grup de quatre places n'hi feien entrar cinc, vuit o deu. La 0070
-- la va tocar per a les sessions de cortesia i va anar amb peus de plom, fins
-- al punt de mantenir la firma byte a byte perquè els `grant` de la 0053
-- seguissin valent. Aquesta migració SÍ que mou la firma, i per això refà els
-- permisos explícitament al final. La protecció de concurrència no s'afluixa
-- enlloc: es fa MÉS ampla.
--
-- EL PROBLEMA
--
-- El pany i el recompte es construïen tots dos sobre (professional, instant
-- exacte):
--
--     pg_advisory_xact_lock(hash(trainer_id || '|' || scheduled_at))
--     ... where scheduled_at = p_scheduled_at
--
-- Mentre totes les sessions comencin en punt, "el mateix instant" i "la mateixa
-- franja" volen dir el mateix i això funciona. Quan una sessió pot començar a
-- les 9:30 i durar una hora, deixen de voler dir el mateix:
--
--   · Un grup a les 9:00 i un altre a les 9:30 són DUES claus de pany
--     diferents. No s'esperen l'un a l'altre: compten en paral·lel.
--   · I compten poblacions disjuntes. Quatre a les 9:00 i quatre a les 9:30
--     són vuit persones a la sala entre les 9:30 i les 10:00, i cap de les dues
--     comprovacions ho veu.
--   · El mateix amb `v_exclusiva`: una sessió individual a les 9:00 no impedia
--     un grup a les 9:30, que la trepitja mitja hora.
--
-- QUÈ CANVIA
--
-- 1. EL PANY PASSA A SER PER PROFESSIONAL, sense l'hora.
--
--    La proposta inicial era per (professional, dia). S'ha descartat, i val la
--    pena dir per què: una sessió que comença a les 23:30 acaba a les 00:30 del
--    dia següent. Amb un pany per dia, aquella sessió i una de les 00:00 cauen
--    en claus DIFERENTS tot i solapar-se — exactament el mateix forat que venim
--    a tapar, només que desplaçat a mitjanit. Que avui el centre tanqui a les
--    22:00 no és una garantia: és una casualitat d'un ajust que es pot canviar
--    des d'una pantalla.
--
--    Amb la clau només del professional no hi ha cap frontera on el raonament
--    es trenqui. El preu és que dues reserves de grup del MATEIX professional
--    se serialitzen encara que siguin de dies diferents. Són transaccions de
--    tres sentències: a l'escala d'aquest centre, això no es nota. Es paga de
--    gust a canvi de no haver de pensar mai més en casos límit.
--
--    S'hi afegeix una guarda per `p_trainer_id` nul: `pg_advisory_xact_lock` és
--    STRICT i amb un argument nul torna sense agafar CAP pany, silenciosament.
--    L'aplicació ja no hi arriba mai sense professional, però un pany que no
--    es queixa quan no tanca res és precisament el que no volem aquí.
--
-- 2. EL RECOMPTE PASSA A SER PER SOLAPAMENT.
--
--    En comptes de `scheduled_at = p_scheduled_at`, la condició de sempre entre
--    dos intervals semioberts: `scheduled_at < fi AND ends_at > inici`. Les
--    reserves ja porten `ends_at` des de la 0082.
--
--    AIXÒ CANVIA EL SIGNIFICAT D'"AFORAMENT", i cal dir-ho clar: abans volia dir
--    "com a molt quatre reserves amb aquesta hora d'inici"; ara vol dir "com a
--    molt quatre persones alhora amb aquest professional". El segon és el que
--    de debò passa a la sala, i és el que la 0053 volia dir quan no hi havia
--    manera que les dues definicions divergissin.
--
-- 3. LA DURADA ENTRA PER PARÀMETRE, amb valor per defecte.
--
--    `p_duration_minutes integer default 60`. El valor per defecte no és
--    cosmètic: permet que una crida amb els sis arguments de sempre segueixi
--    funcionant, de manera que l'ordre entre aplicar la migració i desplegar
--    l'aplicació deixa de ser delicat. Com que afegir un paràmetre crea una
--    SOBRECÀRREGA en comptes de substituir la funció, la de sis arguments
--    s'elimina explícitament abans: si hi fossin totes dues, una crida amb sis
--    arguments seria ambigua i Postgres la rebutjaria.
--
-- EL QUE NO CANVIA
--
-- El descompte del bo amb bloqueig optimista, la derivació de `is_complimentary`
-- a partir de "sense bo", els valors de retorn i els seus `reason`. Qui crida
-- aquesta funció no ha de canviar res per aquesta migració.
--
-- EL QUE SEGUEIX FORA D'AQUÍ, i convé no oblidar-ho
--
-- Aquesta funció protegeix el costat del GRUP: una plaça de grup no entra si
-- trepitja ningú. El camí invers —una reserva INDIVIDUAL que trepitja un grup—
-- no el pot garantir la constraint de la 0082 (les files de grup en queden
-- fora a posta) i el comprova l'aplicació abans d'inserir. Entre aquella
-- comprovació i l'INSERT hi ha una escletxa teòrica, la mateixa que hi havia
-- abans d'aquesta migració amb la igualtat exacta: no és una regressió, però
-- tampoc està tancada. Tancar-la voldria dir fer passar també la reserva
-- individual per una funció amb pany, i això no toca en aquest bloc.
-- ============================================================================

-- La de sis arguments se'n va abans de crear la nova: amb les dues vives, una
-- crida amb sis arguments no sabria a quina anar.
drop function if exists public.book_group_slot(uuid, uuid, integer, uuid, timestamptz, integer);

create or replace function public.book_group_slot(
  p_client_id          uuid,
  p_bono_id            uuid,
  p_expected_remaining integer,
  p_trainer_id         uuid,
  p_scheduled_at       timestamptz,
  p_capacity           integer,
  p_duration_minutes   integer default 60
)
returns jsonb
language plpgsql
as $$
declare
  v_ocupades   integer;
  v_exclusiva  integer;
  v_bono       public.bonos%rowtype;
  v_id         uuid;
  v_remaining  integer;
  v_end        timestamptz;
  -- Les sessions de prova no porten durada pròpia: són una sessió estàndard
  -- del centre. Si algun dia en porten, aquesta línia és la que ha de canviar
  -- (i el seu bessó a lib/data/trial-bookings.ts).
  v_trial_mins constant integer := 60;
begin
  if p_trainer_id is null then
    raise exception 'book_group_slot: cal un professional per reservar una plaça de grup.';
  end if;

  v_end := p_scheduled_at + make_interval(mins => p_duration_minutes);

  -- El torn. `xact` i no `session`: es deixa anar sol quan acaba la transacció,
  -- passi el que passi. La clau és NOMÉS el professional: qualsevol franja seva
  -- pot solapar-se amb qualsevol altra, així que totes han de fer cua a la
  -- mateixa porta. (Vegeu la capçalera: per dia no serveix, per mitjanit.)
  perform pg_advisory_xact_lock(hashtextextended(p_trainer_id::text, 0));

  -- A partir d'aquí ningú més està mirant cap franja d'aquest professional.
  -- Es compta el mateix que compta `slotHasRoom` a l'aplicació: les reserves
  -- vives i les sessions de prova que ocupen el forat — però ara "ocupar" vol
  -- dir solapar-se amb [p_scheduled_at, v_end), no començar al mateix segon.
  -- Les de cortesia hi entren igual: són reserves amb `status = 'booked'`.
  select
    count(*) filter (where true),
    count(*) filter (where service_type <> 'grupo_reducido')
  into v_ocupades, v_exclusiva
  from (
    select service_type
      from public.reservations
     where trainer_id = p_trainer_id
       and status = 'booked'
       and scheduled_at < v_end
       and ends_at > p_scheduled_at
    union all
    select service_type
      from public.trial_bookings
     where trainer_id = p_trainer_id
       and (status = 'confirmed' or (status = 'pending' and expires_at >= now()))
       and scheduled_at < v_end
       and scheduled_at + make_interval(mins => v_trial_mins) > p_scheduled_at
  ) ocupants;

  -- Una sessió que no és de grup ocupa la franja sencera: ara, també si només
  -- la trepitja en part.
  if v_exclusiva > 0 then
    return jsonb_build_object('ok', false, 'reason', 'taken');
  end if;
  if v_ocupades >= p_capacity then
    return jsonb_build_object('ok', false, 'reason', 'full');
  end if;

  -- Reclam de la sessió, amb el mateix bloqueig optimista que ja feia l'app:
  -- si el bo ha canviat des que el va llegir qui ens crida, no es toca.
  --
  -- NOMÉS si hi ha bo. Sense bo és una sessió de cortesia: no hi ha res a
  -- descomptar i no hi ha res que puguin trepitjar dues peticions alhora.
  if p_bono_id is not null then
    update public.bonos
       set remaining_sessions = remaining_sessions - 1,
           status = case
                      when remaining_sessions - 1 = 0 and status = 'active'
                        then 'completed'::public.bono_status
                      else status
                    end,
           first_reservation_at = coalesce(first_reservation_at, now())
     where id = p_bono_id
       and remaining_sessions = p_expected_remaining
       and remaining_sessions > 0
    returning * into v_bono;

    if not found then
      return jsonb_build_object('ok', false, 'reason', 'no_sessions');
    end if;

    v_remaining := v_bono.remaining_sessions;
  end if;

  -- `is_complimentary` es DERIVA de no portar bo, igual que a la 0070.
  -- `ends_at` no s'hi posa: el trigger de la 0082 el calcula sol.
  insert into public.reservations
    (client_id, bono_id, trainer_id, scheduled_at, duration_minutes,
     service_type, status, is_complimentary)
  values
    (p_client_id, p_bono_id, p_trainer_id, p_scheduled_at, p_duration_minutes,
     'grupo_reducido', 'booked', p_bono_id is null)
  returning id into v_id;

  -- Si l'INSERT peta, l'excepció tomba la transacció sencera i el descompte
  -- del bo se'n va amb ella. L'aplicació ja no ha de desfer res a mà.
  return jsonb_build_object('ok', true, 'id', v_id, 'remaining', v_remaining);
end;
$$;

comment on function public.book_group_slot is
  'Reserva una plaça de grup serialitzant per professional amb un advisory lock. Compta l''aforament per SOLAPAMENT de franges, no per instant exacte: com a molt p_capacity persones alhora. Amb p_bono_id null la reserva és de cortesia: no descompta cap sessió, però ocupa plaça igual. Retorna {ok:true,id,remaining} o {ok:false,reason:taken|full|no_sessions}.';

-- Els permisos es refan perquè la firma ha canviat: els `revoke`/`grant` de la
-- 0053 anomenaven els sis tipus exactes i no diuen res d'aquesta funció nova.
-- Mateix criteri que allà: escriu reserves i toca bons per a QUALSEVOL client
-- que se li passi, o sigui que no la pot cridar un navegador. La crida el
-- servidor amb la clau de servei, després d'haver comprovat qui ets.
revoke all on function public.book_group_slot(uuid, uuid, integer, uuid, timestamptz, integer, integer) from public;
revoke all on function public.book_group_slot(uuid, uuid, integer, uuid, timestamptz, integer, integer) from anon;
revoke all on function public.book_group_slot(uuid, uuid, integer, uuid, timestamptz, integer, integer) from authenticated;
grant execute on function public.book_group_slot(uuid, uuid, integer, uuid, timestamptz, integer, integer) to service_role;
