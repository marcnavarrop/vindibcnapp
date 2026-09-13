-- ============================================================================
-- VindiBCN · 0084 — La reserva individual també fa cua a la mateixa porta
--
-- L'ESCLETXA QUE QUEDAVA OBERTA
--
-- La 0082 va posar una constraint EXCLUDE que garanteix que dues sessions NO
-- de grup del mateix professional no es trepitgin. La 0083 va fer que una
-- plaça de grup no entri si trepitja ningú, comptant dins d'un advisory lock.
--
-- Entre les dues quedava un camí sense tapar, i la capçalera de la 0083 ja el
-- deixava escrit: una reserva INDIVIDUAL que trepitja un GRUP.
--
--   · La constraint de la 0082 no el veu: les files de grup en queden fora a
--     posta, perquè quatre places legítimes a la mateixa franja són quatre
--     files i cap constraint d'exclusió sap dir "com a molt quatre".
--   · La comprovació de l'aplicació sí que el veu, però és un SELECT seguit
--     d'un INSERT, i entre els dos no hi ha res. És exactament la cursa que la
--     0053 va descriure per als grups: dues peticions simultànies miren totes
--     dues una franja buida i totes dues escriuen.
--
-- No era una regressió —amb la igualtat exacta d'abans passava igual— però era
-- l'únic tros del sistema on la garantia encara depenia del codi i no de la
-- base. Això s'acaba aquí.
--
-- EL MIRALL
--
-- Aquesta funció és `book_group_slot` amb dues diferències, i cap d'elles toca
-- la part que costa: el pany i el recompte són els mateixos, byte a byte.
--
--   1. NO hi ha aforament. Una sessió individual ocupa la franja sencera, així
--      que la guarda no és "quants n'hi caben" sinó "n'hi ha algú". Qualsevol
--      ocupant que es trepitgi amb la franja demanada la tanca, sigui de grup
--      o no. És el mateix que diu `slotHasRoom` a l'aplicació per als serveis
--      que no són de grup: `existing.length === 0`.
--
--   2. El servei ARRIBA PER PARÀMETRE. La de grup sempre insereix
--      'grupo_reducido'; aquesta serveix ep_individual, ep_parejas i
--      fisioterapia. Es rebutja explícitament 'grupo_reducido': aquell camí té
--      la seva funció, i deixar-lo entrar aquí saltaria l'aforament.
--
-- El pany és el MATEIX que el de la 0083, i això no és una casualitat sinó tot
-- el sentit de la migració: les dues funcions han d'agafar la MATEIXA clau per
-- al mateix professional. Si cadascuna fes servir la seva, un grup i una
-- individual podrien comptar en paral·lel i no veure's —que és precisament el
-- forat que venim a tapar—. Per això la clau surt només de `p_trainer_id`:
-- hashtextextended(p_trainer_id::text, 0), idèntica a l'altra banda.
--
-- SENSE PROFESSIONAL ASSIGNAT
--
-- A diferència de la de grup —que ho rebutja, perquè un grup sense algú que el
-- porti no té sentit— aquí `p_trainer_id` pot ser nul: el formulari manual
-- permet deixar la reserva "sense assignar". Llavors no hi ha cap franja de
-- ningú per la qual competir, i no s'agafa cap pany ni es compta res. És
-- coherent amb la resta: la constraint de la 0082 tampoc bloqueja dues files
-- amb `trainer_id` nul, i l'índex únic de la 0007 tampoc ho feia.
--
-- No es pot resoldre "agafant el pany igualment": `pg_advisory_xact_lock` és
-- STRICT i amb un argument nul torna sense tancar res i sense queixar-se.
--
-- DE PROPINA: EL DESCOMPTE DEL BO DEIXA DE SER UN BALL
--
-- Fins ara l'aplicació feia descomptar → inserir → i, si l'INSERT petava,
-- tornar la sessió al bo a mà. Aquí les dues coses passen dins de la mateixa
-- transacció: si l'INSERT peta, l'excepció se'n duu el descompte amb ella i no
-- hi ha res a desfer. Mateix criteri que la 0053 ja aplicava als grups.
-- ============================================================================

create or replace function public.book_individual_slot(
  p_client_id          uuid,
  p_bono_id            uuid,
  p_expected_remaining integer,
  p_trainer_id         uuid,
  p_scheduled_at       timestamptz,
  p_service_type       public.service_type,
  p_duration_minutes   integer default 60
)
returns jsonb
language plpgsql
as $$
declare
  v_ocupades   integer;
  v_bono       public.bonos%rowtype;
  v_id         uuid;
  v_remaining  integer;
  v_end        timestamptz;
  -- Igual que a la 0083: una prova no porta durada pròpia, és una sessió
  -- estàndard del centre. Si algun dia en porta, aquestes dues línies —aquí i
  -- allà— han de canviar juntes, amb el seu bessó a lib/data/trial-bookings.ts.
  v_trial_mins constant integer := 60;
begin
  if p_service_type = 'grupo_reducido' then
    raise exception
      'book_individual_slot: grupo_reducido va per book_group_slot, que és qui compta l''aforament.';
  end if;

  v_end := p_scheduled_at + make_interval(mins => p_duration_minutes);

  -- Sense professional no hi ha franja de ningú: ni pany ni recompte. Amb
  -- professional, el MATEIX pany que agafa `book_group_slot`, perquè les dues
  -- s'han de veure l'una a l'altra.
  if p_trainer_id is not null then
    perform pg_advisory_xact_lock(hashtextextended(p_trainer_id::text, 0));

    -- A partir d'aquí ningú més està mirant cap franja d'aquest professional,
    -- ni per reservar individual ni per entrar en un grup.
    --
    -- Es compta el mateix que compta `slotHasRoom` a l'aplicació: les reserves
    -- vives i les proves que ocupen el forat, per SOLAPAMENT. Aquí no es filtra
    -- per tipus: una individual no pot entrar ni sobre una altra individual ni
    -- sobre un grup, encara que el grup tingui places lliures.
    select count(*)
      into v_ocupades
      from (
        select 1
          from public.reservations
         where trainer_id = p_trainer_id
           and status = 'booked'
           and scheduled_at < v_end
           and ends_at > p_scheduled_at
        union all
        select 1
          from public.trial_bookings
         where trainer_id = p_trainer_id
           and (status = 'confirmed' or (status = 'pending' and expires_at >= now()))
           and scheduled_at < v_end
           and scheduled_at + make_interval(mins => v_trial_mins) > p_scheduled_at
      ) ocupants;

    if v_ocupades > 0 then
      return jsonb_build_object('ok', false, 'reason', 'taken');
    end if;
  end if;

  -- Reclam de la sessió amb bloqueig optimista, idèntic al de la 0053: si el bo
  -- ha canviat des que el va llegir qui ens crida, no es toca.
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

  -- `is_complimentary` es DERIVA de no portar bo, mateix criteri que la 0070.
  -- `ends_at` no s'hi posa: el trigger de la 0082 el calcula sol.
  insert into public.reservations
    (client_id, bono_id, trainer_id, scheduled_at, duration_minutes,
     service_type, status, is_complimentary)
  values
    (p_client_id, p_bono_id, p_trainer_id, p_scheduled_at, p_duration_minutes,
     p_service_type, 'booked', p_bono_id is null)
  returning id into v_id;

  -- Si l'INSERT peta —per exemple, perquè la constraint de la 0082 hi troba un
  -- solapament que el recompte no havia vist— l'excepció tomba la transacció
  -- sencera i el descompte del bo se'n va amb ella.
  return jsonb_build_object('ok', true, 'id', v_id, 'remaining', v_remaining);
end;
$$;

comment on function public.book_individual_slot is
  'Reserva una sessió que no és de grup, serialitzant per professional amb el MATEIX advisory lock que book_group_slot. Rebutja la franja si s''hi solapa qualsevol reserva viva o prova, sigui de grup o no. Amb p_bono_id null la reserva és de cortesia. Retorna {ok:true,id,remaining} o {ok:false,reason:taken|no_sessions}.';

-- Mateix criteri que `book_group_slot`: escriu reserves i toca bons per a
-- QUALSEVOL client que se li passi, o sigui que no la pot cridar un navegador.
-- La crida el servidor amb la clau de servei, després d'haver comprovat qui ets
-- i què pots reservar.
revoke all on function public.book_individual_slot(uuid, uuid, integer, uuid, timestamptz, public.service_type, integer) from public;
revoke all on function public.book_individual_slot(uuid, uuid, integer, uuid, timestamptz, public.service_type, integer) from anon;
revoke all on function public.book_individual_slot(uuid, uuid, integer, uuid, timestamptz, public.service_type, integer) from authenticated;
grant execute on function public.book_individual_slot(uuid, uuid, integer, uuid, timestamptz, public.service_type, integer) to service_role;
