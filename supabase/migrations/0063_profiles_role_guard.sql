-- ============================================================================
-- VindiBCN · 0063 — El rol d'un perfil deixa de ser cosa de qui el té
--
-- La política `profiles_update` de la 0001 diu això:
--
--   for update using (id = auth.uid() or public.is_admin())
--   with check (id = auth.uid() or public.is_admin())
--
-- És una política de FILA. Autoritza editar la teva pròpia fila, i `role` és
-- una columna d'aquesta fila: la RLS no distingeix entre canviar-te el telèfon
-- i canviar-te el rol. Amb una sessió de client normal i la clau anon —que és
-- pública per disseny, va dins del bundle del navegador— n'hi havia prou amb:
--
--   PATCH /rest/v1/profiles?id=eq.<jo>   {"role":"admin"}   → 204
--
-- i a partir d'aquí `is_admin()` deia que sí a tot arreu: pagaments, bons,
-- fitxes, consentiments, documents. Comprovat contra el projecte real.
--
-- PER QUÈ UN TRIGGER I NO UNA EXPRESSIÓ A LA POLÍTICA
--
-- Una policy de RLS no veu l'OLD: dins del `with check` només hi ha la fila
-- nova, així que "el rol no ha canviat" no s'hi pot escriure sense sub-consultar
-- la mateixa taula, que és exactament la recursió que les funcions SECURITY
-- DEFINER de la 0001 existeixen per evitar. Un `before update` sí que té OLD i
-- NEW, ho diu en una línia, i es llegeix.
--
-- I és defensa en profunditat: val per a QUALSEVOL camí d'escriptura —PostgREST,
-- una policy que algú afluixi demà, un UPDATE des del SQL Editor amb sessió
-- d'usuari—, no només per al que hem trobat avui.
--
-- QUI SÍ QUE POT
--
--   · El servidor amb la clau de servei (`auth.uid()` és NULL). És el camí de
--     l'alta de professionals i el de la consola de Supabase.
--   · Un admin amb sessió, que ja el podia canviar i ha de poder seguir.
--
-- La resta, no. I no en silenci: un 42501 perquè qui ho intenti ho vegi.
-- ============================================================================

create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Cap canvi de rol: aquest trigger no hi té res a dir.
  if new.role is not distinct from old.role then
    return new;
  end if;

  -- Sense `auth.uid()` no hi ha sessió de navegador: és el servidor amb la
  -- clau de servei. La clau de servei ja se salta la RLS sencera, així que
  -- barrar-la aquí no protegiria de res i trencaria l'alta de professionals.
  if auth.uid() is null then
    return new;
  end if;

  -- Amb sessió, només l'admin. `coalesce` perquè `is_admin()` torna NULL si
  -- qui pregunta no té perfil, i un NULL no ha de passar per un sí.
  if coalesce(public.is_admin(), false) then
    return new;
  end if;

  raise exception 'Només un administrador pot canviar el rol d''un perfil.'
    using errcode = '42501';
end;
$$;

comment on function public.guard_profile_role is
  'Barra els canvis de profiles.role que no vinguin d''un admin o del servidor (service_role).';

drop trigger if exists profiles_guard_role on public.profiles;
create trigger profiles_guard_role
  before update on public.profiles
  for each row execute function public.guard_profile_role();

-- La lliçó de la 0061, aplicada d'entrada i no dues migracions després: el
-- `grant` no serveix de res sense el `revoke` de davant. Una funció de trigger
-- no l'exposa PostgREST (torna `trigger`), però això és el patró de la casa i
-- no depèn que PostgREST segueixi decidint el mateix demà.
revoke execute on function public.guard_profile_role() from public;
revoke execute on function public.guard_profile_role() from anon;
revoke execute on function public.guard_profile_role() from authenticated;
