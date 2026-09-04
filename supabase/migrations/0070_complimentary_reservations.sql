-- ============================================================================
-- VindiBCN · 0070 — Sessions de cortesia
--
-- Una sessió gratuïta que el centre regala: no descompta cap sessió de cap bo.
-- Funciona per a tot el catàleg, individual i grup.
--
-- EL QUE NO CANVIA, I ÉS EL MÉS IMPORTANT: l'aforament. Una plaça de cortesia
-- en un grup OCUPA plaça i compta contra el màxim de quatre igual que
-- qualsevol altra. L'única cosa que se salta és el descompte del bo.
--
-- Això es compleix sol i sense tocar-ho: el recompte de `book_group_slot` mira
-- `status = 'booked'` i no mira el bo per res. Una fila de cortesia hi entra
-- com les altres.
-- ============================================================================

alter table public.reservations
  add column if not exists is_complimentary boolean not null default false;

comment on column public.reservations.is_complimentary is
  'Sessió de cortesia: gratuïta i sense consumir cap sessió de bo (bono_id és null). Ocupa plaça i compta per a l''aforament dels grups com qualsevol altra reserva. S''exclou del càlcul de liquidacions i bonus.';

-- Sense índex a posta: aquesta columna es llegeix fila a fila per pintar el
-- distintiu i mai s'hi filtra. Un índex per a tres files de cada mil seria
-- manteniment sense lectura que l'aprofiti.

-- ─── book_group_slot: el bo passa a ser opcional ────────────────────────────
--
-- LA FIRMA NO CANVIA. Els sis paràmetres, els seus tipus i els seus noms es
-- queden igual, i per tant els `revoke`/`grant` de la 0053 —que anomenen els
-- tipus exactes— segueixen valent sense tocar-los. `p_bono_id` i
-- `p_expected_remaining` ja acceptaven NULL pel seu tipus: no calen `DEFAULT`,
-- només que el cos sàpiga què fer quan arriben buits.
--
-- QUÈ ES MOU I QUÈ NO. El lock, el recompte d'ocupants i les guardes d'aforament
-- no anomenen `p_bono_id` ni `p_expected_remaining` enlloc: es construeixen amb
-- (professional, hora) i `p_capacity`. Es queden byte a byte com estaven. L'únic
-- bloc que toca el bo queda dins d'un `if`. La protecció de concurrència, que és
-- el que va costar de deixar bé, no s'ha mogut.
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
  v_remaining  integer;
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
  -- vives i les sessions de prova que ocupen el forat. Les de cortesia hi
  -- entren igual —són reserves amb `status = 'booked'`— i per això ocupen
  -- plaça sense haver d'afegir-hi res.
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

  -- `is_complimentary` es DERIVA de no portar bo, i aquí això és exacte: els
  -- dos camins que criden aquesta funció (la reserva del client i la que crea
  -- l'admin o el professional) sempre passen un bo, excepte quan l'ometem
  -- expressament per regalar la sessió. Dins d'aquesta funció, "sense bo" vol
  -- dir cortesia. Si algun dia hi ha un tercer camí que insereixi sense bo per
  -- un altre motiu, aquesta línia és la que caldrà revisar.
  insert into public.reservations
    (client_id, bono_id, trainer_id, scheduled_at, service_type, status, is_complimentary)
  values
    (p_client_id, p_bono_id, p_trainer_id, p_scheduled_at, 'grupo_reducido', 'booked',
     p_bono_id is null)
  returning id into v_id;

  -- Si l'INSERT peta, l'excepció tomba la transacció sencera i el descompte
  -- del bo se'n va amb ella. L'aplicació ja no ha de desfer res a mà.
  --
  -- `remaining` torna NULL quan no hi ha bo: no hi ha cap comptador que
  -- informar, i qui crida ja sap que no n'esperava cap.
  return jsonb_build_object('ok', true, 'id', v_id, 'remaining', v_remaining);
end;
$$;

comment on function public.book_group_slot is
  'Reserva una plaça de grup serialitzant per franja amb un advisory lock. Amb p_bono_id null la reserva és de cortesia: no descompta cap sessió, però ocupa plaça igual. Retorna {ok:true,id,remaining} o {ok:false,reason:taken|full|no_sessions}.';
