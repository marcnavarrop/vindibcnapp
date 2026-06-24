-- ============================================================================
-- VindiBCN · 0006 — Visibilidad de perfiles para entrenadores (coordinación)
--
-- La 0005 abrió el SELECT de clients/bonos/reservations a cualquier entrenador,
-- pero los nombres/correos viven en `profiles`, cuya policy solo dejaba ver el
-- perfil de los clientes ASIGNADOS. Resultado: en la vista "Tots" el resto de
-- clientes salían sin nombre. Aquí ampliamos profiles_select para que un
-- entrenador vea los perfiles de clientes y de otros entrenadores (no los de
-- admin), de modo que la coordinación muestre nombres y contacto.
-- ============================================================================

drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select using (
    id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.clients c
      where c.profile_id = profiles.id
        and c.assigned_trainer_id = auth.uid()
    )
    or (public.is_trainer() and role <> 'admin')
  );
