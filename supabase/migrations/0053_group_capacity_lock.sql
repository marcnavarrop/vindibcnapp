-- ============================================================================
-- VindiBCN · 0053 — L'aforament dels grups deixa de ser una cursa
--
-- La 0007 va posar un índex únic que impedeix dues reserves a la mateixa
-- franja... excepte per als grups, que n'admeten quatre, i allà el comentari
-- deia "el aforo se valida en la aplicación". El problema és que validar-ho a
-- l'aplicació vol dir: SELECT quantes n'hi ha → decidir → INSERT, i entre el
-- SELECT i l'INSERT no hi ha res. Deu peticions simultànies veuen totes zero
-- ocupades i totes insereixen.
--
-- No és teòric: amb deu clients disparant alhora contra una franja de quatre
-- places van entrar-hi cinc, vuit i deu segons la ronda. Les mateixes deu
-- peticions contra una franja individual en deixaven passar exactament una,
-- perquè allà la garantia és de la base i no del codi.
--
-- Aquí es fa el mateix per als grups. No es pot amb un índex únic —quatre files
-- legítimes són quatre files—, així que es serialitza per franja: qui entra
-- agafa un advisory lock de (professional, hora) i qualsevol altra petició per
-- a la MATEIXA franja espera el seu torn. Les altres franges no s'assabenten
-- de res i segueixen en paral·lel.
--
-- S'ha triat l'advisory lock i no un `select ... for update` perquè no hi ha
-- cap fila que representi la franja: les franges surten de les regles de
-- disponibilitat, no d'una taula de sessions. Bloquejar la regla setmanal
-- serialitzaria totes les hores d'aquell dia, que és molt més del que cal.
-- ============================================================================

create or replace function public.book_group_slot(
  p_client_id          uuid,
  p_bono_id            uuid,
  p_expected_remaining integer,
  p_trainer_id         uuid,
  p_scheduled_at       timestamptz,
  p_capacity           integer
)
returns jsonb
language plpgsql
as $$
declare
  v_ocupades   integer;
  v_exclusiva  integer;
  v_bono       public.bonos%rowtype;
  v_id         uuid;
begin
  -- El torn. `xact` i no `session`: es deixa anar sol quan acaba la
  -- transacció, passi el que passi, sense haver de recordar alliberar-lo.
  -- La clau surt del parell (professional, hora) i de res més, que és
  -- exactament el gra que volem: dues franges diferents no es toquen.
  perform pg_advisory_xact_lock(
    hashtextextended(p_trainer_id::text || '|' || p_scheduled_at::text, 0)
  );

  -- A partir d'aquí ningú més pot estar mirant aquesta mateixa franja.
  -- Es compta el mateix que compta `slotHasRoom` a l'aplicació: les reserves
  -- vives i les sessions de prova que ocupen el forat.
  select
    count(*) filter (where true),
    count(*) filter (where service_type <> 'grupo_reducido')
  into v_ocupades, v_exclusiva
  from (
    select service_type
      from public.reservations
     where trainer_id = p_trainer_id
       and scheduled_at = p_scheduled_at
       and status = 'booked'
    union all
    select service_type
      from public.trial_bookings
     where trainer_id = p_trainer_id
       and scheduled_at = p_scheduled_at
       and (status = 'confirmed' or (status = 'pending' and expires_at >= now()))
  ) ocupants;

  -- Una sessió que no és de grup ocupa la franja sencera.
  if v_exclusiva > 0 then
    return jsonb_build_object('ok', false, 'reason', 'taken');
  end if;
  if v_ocupades >= p_capacity then
    return jsonb_build_object('ok', false, 'reason', 'full');
  end if;

  -- Reclam de la sessió, amb el mateix bloqueig optimista que ja feia l'app:
  -- si el bo ha canviat des que el va llegir qui ens crida, no es toca.
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

  insert into public.reservations
    (client_id, bono_id, trainer_id, scheduled_at, service_type, status)
  values
    (p_client_id, p_bono_id, p_trainer_id, p_scheduled_at, 'grupo_reducido', 'booked')
  returning id into v_id;

  -- Si l'INSERT peta, l'excepció tomba la transacció sencera i el descompte
  -- del bo se'n va amb ella. L'aplicació ja no ha de desfer res a mà.
  return jsonb_build_object('ok', true, 'id', v_id, 'remaining', v_bono.remaining_sessions);
end;
$$;

comment on function public.book_group_slot is
  'Reserva una plaça de grup serialitzant per franja amb un advisory lock. Retorna {ok:true,id,remaining} o {ok:false,reason:taken|full|no_sessions}.';

-- Aquesta funció escriu reserves i toca bons per a QUALSEVOL client que se li
-- passi: no la pot poder cridar un navegador. La crida el servidor amb la clau
-- de servei, després d'haver comprovat qui ets i què pots reservar.
revoke all on function public.book_group_slot(uuid, uuid, integer, uuid, timestamptz, integer) from public;
revoke all on function public.book_group_slot(uuid, uuid, integer, uuid, timestamptz, integer) from anon;
revoke all on function public.book_group_slot(uuid, uuid, integer, uuid, timestamptz, integer) from authenticated;
grant execute on function public.book_group_slot(uuid, uuid, integer, uuid, timestamptz, integer) to service_role;
