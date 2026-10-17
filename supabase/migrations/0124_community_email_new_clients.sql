-- ============================================================================
-- VindiBCN · 0124 — «Novetats de la comunitat» per correu, activat per als
--                    CLIENTS NOUS (art. 21.2 LSSI)
--
-- Decisió d'en Marc (17/10/2026): un client nou rep per defecte el correu de
-- les novetats del centre. Els clients que ja hi són, els professionals i els
-- admins NO canvien. L'art. 21.2 LSSI hi obliga a dues coses, que fa l'app:
-- dir-ho en l'alta (amb la possibilitat de desactivar-ho en aquell moment) i un
-- enllaç per deixar de rebre'ls a cada correu.
--
-- QUÈ FA
--
--   · `community_notice_at`: quan se li ha dit al client (i ha pogut dir que
--     no). NULL = encara no: l'app li ensenya l'avís a l'Inici fins que el
--     confirma. Els perfils que ja existeixen queden marcats com a «ja vist»
--     (no se'ls ensenya res: no se'ls ha activat res).
--   · El trigger que crea les preferències (0019) posa `community_email = true`
--     si el perfil neix com a client. Tots neixen com a client (0064): el
--     servidor puja el rol DESPRÉS a professional o admin.
--   · Per això, quan un perfil passa de client a professional o admin i encara
--     no se li ha dit res (`community_notice_at` NULL, és a dir, acabat de
--     crear), el correu de comunitat torna a `false`: l'equip no canvia.
--
-- Idempotent: `if not exists`, `create or replace`, `drop trigger if exists`.
-- ============================================================================

alter table public.notification_preferences
  add column if not exists community_notice_at timestamptz;

comment on column public.notification_preferences.community_notice_at is
  'Quan se li ha dit al client que rebrà les novetats per correu i ha pogut desactivar-les (art. 21.2 LSSI). NULL = encara no (0124).';

-- Els que ja hi són: res a dir-los (no se''ls activa res).
update public.notification_preferences
   set community_notice_at = created_at
 where community_notice_at is null;

-- El trigger de 0019, ara amb el valor per defecte segons el rol de naixement.
create or replace function public.handle_new_profile_prefs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notification_preferences (profile_id, community_email)
  values (new.id, new.role = 'client')
  on conflict (profile_id) do nothing;
  return new;
end;
$$;

comment on function public.handle_new_profile_prefs() is
  'Crea les preferències d''un perfil nou. Un client nou rep les novetats de la comunitat per correu (0124).';

-- Si el servidor el puja a professional o admin just després de crear-lo, el
-- correu de comunitat torna a estar apagat (com sempre per a l'equip).
create or replace function public.reset_community_email_on_promotion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role = 'client' and new.role <> 'client' then
    update public.notification_preferences
       set community_email = false,
           community_notice_at = now()
     where profile_id = new.id
       and community_notice_at is null;
  end if;
  return new;
end;
$$;

comment on function public.reset_community_email_on_promotion() is
  'Un perfil acabat de crear que passa a professional o admin no rep el correu de comunitat per defecte (0124).';

drop trigger if exists on_profile_promoted_community on public.profiles;
create trigger on_profile_promoted_community
  after update of role on public.profiles
  for each row execute function public.reset_community_email_on_promotion();

revoke execute on function public.reset_community_email_on_promotion() from public, anon, authenticated;
