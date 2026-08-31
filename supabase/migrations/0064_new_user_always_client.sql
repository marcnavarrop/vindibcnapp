-- ============================================================================
-- VindiBCN · 0064 — Qui s'apunta neix client, digui el que digui
--
-- El trigger d'alta llegia el rol del metadata del signUp:
--
--   coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'client')
--
-- El formulari de /register hi posa "client", però això és JavaScript del
-- navegador i el metadata l'escriu qui fa la petició. L'endpoint públic
-- /auth/v1/signup accepta el `data` que li donis, i la clau anon és pública per
-- disseny. Un POST amb {"data":{"role":"admin"}} creava un admin sense sessió
-- prèvia, sense invitació i sense passar per l'app. Comprovat contra el
-- projecte real: perfil amb role='admin' i lectura de payments, bonos, clients,
-- profiles i gift_vouchers.
--
-- El comentari de la 0001 ho descrivia com una funcionalitat ("el rol es puede
-- pasar en raw_user_meta_data") i afegia que admin i trainer "se otorgan
-- manualmente". Res ho impedia: era una nota, no un control.
--
-- A partir d'aquí el rol del metadata NO es mira. Mai. El perfil nou és
-- 'client' i prou.
--
-- L'IDIOMA SÍ QUE ES SEGUEIX LLEGINT
--
-- `preferred_language` es queda tal com el va deixar la 0058: ve del mateix
-- metadata, però mentir-hi no dona cap privilegi —com a molt et surt l'app en
-- un idioma que no has triat— i el `case` ja només accepta els tres coneguts.
--
-- COM ES CREEN ARA ELS PROFESSIONALS
--
-- Pel camí que ja hi era: `createUserWithInvite` (lib/notifications/auth-emails.ts),
-- que corre al servidor amb la clau de servei. Fins ara delegava el rol al
-- metadata i el posava aquest trigger; ara el fixa ell mateix amb un UPDATE
-- explícit just després de crear l'usuari. Aquest UPDATE passa el guardià de la
-- 0063 perquè la clau de servei no té `auth.uid()`.
--
-- Les dues coses van juntes: aquesta migració sense aquell canvi de codi
-- deixaria els professionals nous donats d'alta com a clients.
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, preferred_language)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    -- Literal, no `coalesce(metadata, 'client')`: el metadata no decideix
    -- privilegis. Qui hagi de ser admin o professional, que el pugi el
    -- servidor després, amb la clau de servei.
    'client',
    -- Només s'accepten els tres coneguts: qualsevol altra cosa cau al català.
    case new.raw_user_meta_data ->> 'preferred_language'
      when 'ca' then 'ca'
      when 'es' then 'es'
      when 'en' then 'en'
      else 'ca'
    end
  );
  return new;
end;
$$;

comment on function public.handle_new_user is
  'Crea el perfil en donar-se d''alta. El rol és SEMPRE client: el metadata del signUp no atorga privilegis (0064).';
