-- ============================================================================
-- VindiBCN · 0115 — L'historial clínic: el `on delete set null` de l'autor funciona
--
-- EL PROBLEMA (0110)
--
-- `clinical_first_visit_touch` i `clinical_followup_touch` tornen a posar
-- l'autor (`created_by`, `author_id`) com era a cada UPDATE, perquè ningú el
-- pugui canviar. Però el `on delete set null` d'aquestes columnes, Postgres el
-- fa amb un UPDATE intern, que també dispara el trigger: quan s'esborra el perfil
-- d'un professional, el trigger desfà el NULL. Què passa llavors:
--
--   · Seguiments (una FK): la clau «no canvia», Postgres no la torna a
--     comprovar i l'esborrat no falla, però l'entrada queda apuntant a un perfil
--     que ja no existeix (un orfe) i amb la data d'edició canviada.
--   · Primera visita creada I editada per la mateixa persona (dues FK, i en
--     crear-la `updated_by` = `created_by`): Postgres fa un UPDATE per FK; al
--     segon la fila ja és d'aquesta transacció i sí que comprova `created_by`.
--     L'esborrat del perfil FALLA (23503): no es pot donar de baixa ningú que
--     hagi escrit una primera visita.
--
-- Prova: supabase/tests/0115_clinical_author_delete.sql (abans i després).
--
-- L'ARREGLA
--
--   · L'autor només pot passar a NULL, i només si el seu perfil JA NO EXISTEIX:
--     és el cas del `set null`. Ningú no el pot canviar a un altre valor, ni
--     esborrar-lo d'una entrada d'algú que segueix al centre.
--   · Si el text (`body`) no canvia, la data d'edició (`updated_at`) i qui ha
--     editat (`updated_by`) es queden com eren: un UPDATE que no toca el text no
--     és una edició. `updated_by` també passa a NULL si el seu perfil ja no hi és.
--   · Editar el TEXT segueix com fins ara: `updated_at = now()` i, a la primera
--     visita, `updated_by = auth.uid()`.
--
-- `profile_exists` és SECURITY DEFINER: la RLS de `profiles` podria amagar un
-- perfil que existeix a qui edita, i llavors el trigger el donaria per esborrat.
-- Només diu sí o no.
--
-- No neteja res: comprovat a producció el 17/10/2026, cap entrada de
-- l'historial apunta a un perfil esborrat.
--
-- Només `create or replace`: ni taules, ni triggers, ni polítiques.
-- ============================================================================

create or replace function public.profile_exists(p_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles p where p.id = p_profile)
$$;

comment on function public.profile_exists(uuid) is
  'Aquest perfil existeix (sense passar per la RLS de profiles). Per als triggers de l''historial clínic (0115).';

revoke execute on function public.profile_exists(uuid) from public, anon;
grant  execute on function public.profile_exists(uuid) to authenticated, service_role;

-- L'autor (o qui ha editat): es queda com era, llevat que passi a NULL perquè el
-- seu perfil ja no existeix (el `on delete set null`).
create or replace function public.clinical_keep_author(p_old uuid, p_new uuid)
returns uuid
language sql
stable
set search_path = public
as $$
  select case
    when p_new is null and p_old is not null and not public.profile_exists(p_old) then null
    else p_old
  end
$$;

comment on function public.clinical_keep_author(uuid, uuid) is
  'Autor d''una entrada clínica en un UPDATE: el d''abans, o NULL si el seu perfil ja no existeix (0115).';

revoke execute on function public.clinical_keep_author(uuid, uuid) from public, anon;
grant  execute on function public.clinical_keep_author(uuid, uuid) to authenticated, service_role;

-- Primera visita -----------------------------------------------------------------

create or replace function public.clinical_first_visit_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.updated_at := now();
    new.updated_by := new.created_by;
  else
    new.client_id  := old.client_id;
    new.created_by := public.clinical_keep_author(old.created_by, new.created_by);
    new.created_at := old.created_at;
    if new.body is distinct from old.body then
      -- Una edició de veritat: la data i qui l'ha feta.
      new.updated_at := now();
      new.updated_by := coalesce(auth.uid(), new.updated_by);
    else
      -- No ha canviat el text (p. ex. el `set null` d'un perfil esborrat).
      new.updated_at := old.updated_at;
      new.updated_by := public.clinical_keep_author(old.updated_by, new.updated_by);
    end if;
  end if;
  return new;
end;
$$;

-- Seguiment ----------------------------------------------------------------------

create or replace function public.clinical_followup_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.updated_at := now();
  else
    new.client_id  := old.client_id;
    new.author_id  := public.clinical_keep_author(old.author_id, new.author_id);
    new.created_at := old.created_at;
    if new.body is distinct from old.body then
      new.updated_at := now();
    else
      new.updated_at := old.updated_at;
    end if;
  end if;
  return new;
end;
$$;
