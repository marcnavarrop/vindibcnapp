-- ============================================================================
-- VindiBCN · 0096 — «Cancel·lar per centre» ja no deixa passar un NULL
--
-- FINS ARA
--
-- `cancel_reservations_by_center` (0090, redefinida a la 0091) decidia qui hi
-- podia entrar amb:
--
--   if not (public.is_admin() or (public.is_trainer() and auth.uid() = p_trainer_id))
--
-- `is_admin()` llegeix el rol del perfil de `auth.uid()`. Amb una sessió vàlida
-- però SENSE fila a `profiles`, torna NULL (no false); `is_trainer()` torna
-- false. La condició sencera dona NULL, i en plpgsql `if not NULL` no entra:
-- la comprovació no aturava ningú. Qui arribés aquí sense perfil podia
-- cancel·lar reserves de QUALSEVOL professional, amb devolució al bo i
-- correus.
--
-- Com es pot tenir sessió sense perfil: l'esborrat RGPD fa
-- `auth.admin.deleteUser` i el perfil cau en cascada, però el token d'accés de
-- l'usuari esborrat continua sent vàlid fins que caduca (per defecte, una
-- hora). També un perfil esborrat a mà. La clau de servei no hi arribava:
-- l'`auth.uid() is null` de sobre ja la para.
--
-- Es va trobar revisant totes les funcions després que la 0095 tingués el
-- mateix forat (`payments_summary`, corregida abans d'aplicar-se bé).
--
-- QUÈ CANVIA
--
-- Només la comprovació: `if not coalesce(…, false)`. La resta del cos és el
-- de la 0091 tal qual. Mateixa signatura i mateix tipus de retorn, així que
-- `create or replace` conserva els permisos de la 0090 (fora public i anon,
-- authenticated sí) i el fitxer es pot aplicar dues vegades.
-- ============================================================================

create or replace function public.cancel_reservations_by_center(
  p_trainer_id uuid,
  p_ids        uuid[],
  p_today      date
)
returns table (
  reservation_id   uuid,
  client_id        uuid,
  bono_id          uuid,
  trainer_id       uuid,
  series_id        uuid,
  scheduled_at     timestamptz,
  service_type     public.service_type,
  refunded         boolean,
  bono_expired     boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_trainer_id is null then
    raise exception 'cancel_reservations_by_center: falta el professional.'
      using errcode = '22004';
  end if;
  if auth.uid() is null then
    raise exception 'cancel_reservations_by_center: cal una sessió d''usuari.'
      using errcode = '42501';
  end if;
  -- `coalesce`: una sessió sense fila a `profiles` fa is_admin() NULL, i
  -- `if not NULL` no entra (0096).
  if not coalesce(
    public.is_admin()
    or (public.is_trainer() and auth.uid() = p_trainer_id),
    false
  ) then
    raise exception 'cancel_reservations_by_center: no autoritzat.'
      using errcode = '42501';
  end if;

  return query
  select * from public.cancel_reservations_core(p_ids, p_trainer_id, true, true, p_today);
end;
$$;

-- ----------------------------------------------------------------------------
-- VERIFICACIÓ (només lectura). Ha de tornar true:
--
--   select position('coalesce(' in pg_get_functiondef(
--            'public.cancel_reservations_by_center(uuid, uuid[], date)'::regprocedure)) > 0
--          as corregida,
--          has_function_privilege('authenticated',
--            'public.cancel_reservations_by_center(uuid, uuid[], date)', 'execute') as authenticated,
--          not has_function_privilege('anon',
--            'public.cancel_reservations_by_center(uuid, uuid[], date)', 'execute') as anon_fora;
-- ----------------------------------------------------------------------------
