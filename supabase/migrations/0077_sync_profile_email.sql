-- ============================================================================
-- VindiBCN · 0077 — El correu del perfil deixa de quedar-se enrere
--
-- `public.profiles.email` només s'ha escrit MAI una vegada: al `handle_new_user`
-- de la 0001 (avui, 0064), que és un trigger `after INSERT on auth.users`. No hi
-- ha hagut mai cap trigger d'UPDATE. Vol dir que, un cop creat el compte, el
-- correu del perfil no torna a moure's encara que el d'Auth sí que ho faci.
--
-- Comprovat contra el projecte real amb un usuari de proves: canviant el correu
-- pels TRES camins, `profiles.email` es va quedar amb el valor antic en tots.
--
--   1. Admin API  (`auth.admin.updateUserById`)  → profiles.email intacte
--   2. API pública (`auth.updateUser({email})`)   → profiles.email intacte
--   3. Consola de Supabase (a mà)                 → mateix camí que el 1
--
-- Això no és cosmètic. `profiles.email` és la columna d'on surten TOTS els
-- avisos: `notify()` hi llegeix el destinatari, i les llistes de l'admin
-- ensenyen aquest correu. Un perfil desincronitzat vol dir avisos que se'n van
-- a una bústia que la persona ja no fa servir, mentre la fitxa n'ensenya una
-- altra i ningú ho veu fins que algú es queixa que no li arriba res.
--
-- Fins ara ho tapava una disciplina, no una garantia: `updateClientRecord` té
-- el correu tret del TIPUS a posta (`Omit<ClientInput,"email">`) perquè no es
-- pogués canviar per la meitat. Això protegia el camí de l'app; no protegia el
-- de la consola, que és el que fem servir quan hi ha un problema de debò.
--
-- PER QUÈ UN TRIGGER I NO ARREGLAR-HO A CADA CAMÍ
--
-- Perquè els camins no els controlem tots. El codi de l'app el podem obligar a
-- escriure les dues columnes; la consola de Supabase, no. Un `after update` a
-- `auth.users` és l'únic lloc pel qual passen tots tres, i deixa la garantia a
-- la base i no a que qui toqui això d'aquí a un any recordi la segona columna.
-- Mateix criteri que l'índex únic de la 0054 i que el guardià de la 0063.
--
-- PER QUÈ `of email` I EL `when`
--
-- GoTrue escriu a `auth.users` contínuament: cada login toca `last_sign_in_at`,
-- cada refresc de token toca `updated_at`. Sense les dues restriccions, aquest
-- trigger s'executaria a cada refresc de sessió de cada usuari per no fer res.
-- Amb `of email` + `when (... is distinct from ...)` només corre quan el correu
-- canvia de veritat, que és unes quantes vegades l'any.
--
-- QUÈ NO FA
--
-- No toca `auth.users.raw_user_meta_data ->> 'email'`, la tercera còpia. És una
-- columna de GoTrue i escriure-hi des d'un trigger sobre la seva pròpia taula
-- és buscar-se problemes a cada actualització seva. I no cal: no la llegeix
-- ningú —de tot el metadata, el codi només fa servir `full_name`
-- (`lib/notifications/auth-emails.ts`)—. Queda com a residu del `signUp`, i
-- documentat aquí perquè qui la trobi desfasada sàpiga que ho està a posta.
-- ============================================================================

create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Si el perfil encara no existeix, no és feina d'aquest trigger crear-lo:
  -- d'això ja se n'ocupa `handle_new_user` a l'INSERT. L'UPDATE es queda en no-op.
  update public.profiles
     set email = new.email
   where id = new.id;
  return new;
end;
$$;

comment on function public.sync_profile_email is
  'Copia auth.users.email a profiles.email quan el correu d''accés canvia (0077).';

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (new.email is distinct from old.email)
  execute function public.sync_profile_email();

-- El patró de la casa des de la 0061/0065: el `revoke` va davant, encara que
-- PostgREST no exposi una funció que torna `trigger`. No depenem que segueixi
-- decidint el mateix demà.
revoke execute on function public.sync_profile_email() from public;
revoke execute on function public.sync_profile_email() from anon;
revoke execute on function public.sync_profile_email() from authenticated;

-- ----------------------------------------------------------------------------
-- Reparació de les files que ja haguessin quedat desaparellades abans d'avui.
-- En el moment d'escriure la migració, comprovat contra producció: 0 files
-- (12 perfils, 12 usuaris). Es deixa igualment perquè és idempotent i perquè
-- una migració ha de poder aplicar-se a una base que no sigui la d'avui.
-- ----------------------------------------------------------------------------
update public.profiles p
   set email = u.email
  from auth.users u
 where p.id = u.id
   and p.email is distinct from u.email;
