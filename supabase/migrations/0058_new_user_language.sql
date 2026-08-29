-- ============================================================================
-- VindiBCN · 0058 — El perfil neix amb l'idioma que s'ha triat a l'alta
--
-- `profiles.preferred_language` existeix des de la 0008, però el trigger que
-- crea el perfil no l'ha omplert mai: només copiava `full_name` i `role` del
-- metadata del signUp. Fins ara no importava —la preferència no traduïa res—,
-- però ara el formulari de registre demana l'idioma i cal que arribi.
--
-- Es fa al trigger i no amb un UPDATE després del signUp perquè així el perfil
-- ja neix bé, dins de la mateixa transacció. Una segona escriptura pot fallar i
-- deixaria l'usuari amb l'app en un idioma que no ha demanat, just a la
-- primera pantalla que veu.
--
-- El `check` de la 0008 (ca | es | en) segueix manant: un valor estrany al
-- metadata cauria al default en comptes de petar l'alta.
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
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'client'),
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
