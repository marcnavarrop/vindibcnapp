-- 0100 · El contacte del centre, configurable: font única per a tota l'app.
--
-- Fins ara el contacte era un text provisional ([CONTACTE_CENTRE] al manual del
-- client, [EMAIL_CONTACTE], [ADREÇA], [NOM_RESPONSABLE] i [NIF] a les pàgines
-- legals) o estava escrit a mà (l'adreça de l'esdeveniment de calendari). Ara
-- l'admin ho posa a Configuració → Centre i ho llegeix tot des d'aquí.
--
--   contact_phone     telèfon que veu el client (tel:), guardat net: + i dígits
--                     amb espais opcionals («+34 931 23 45 67»).
--   contact_whatsapp  si aquest mateix telèfon té WhatsApp.
--   contact_email     la bústia que el centre LLEGEIX. No és el remitent dels
--                     avisos automàtics (NOTIFICATIONS_FROM_EMAIL), que no es
--                     llegeix. És el Reply-To dels correus al client, i només
--                     quan està informat.
--   notify_email      on van els avisos interns (proves, altes). Buit: el de
--                     contacte; tots dos buits: la variable CENTER_EMAIL.
--   address           adreça del centre (pàgines legals, calendari).
--   legal_name        titular per a les pàgines legals.
--   tax_id            NIF / CIF del titular, en majúscules.
--
-- Buit és sempre NULL (mai una cadena buida): ho garanteixen els checks.
--
-- LECTURA: la RLS no canvia. Qualsevol sessió ja pot llegir la fila (són
-- dades públiques del centre), i les pàgines sense sessió (/prova, /legal) les
-- reben del servidor, que llegeix amb la clau de servei i només n'envia el
-- contacte. ESCRIPTURA: la policy de sempre, només l'admin.
--
-- Idempotent: es pot tornar a aplicar.

alter table public.center_settings
  add column if not exists contact_phone    text,
  add column if not exists contact_whatsapp boolean not null default false,
  add column if not exists contact_email    text,
  add column if not exists notify_email     text,
  add column if not exists address          text,
  add column if not exists legal_name       text,
  add column if not exists tax_id           text;

alter table public.center_settings drop constraint if exists center_settings_contact_phone_chk;
alter table public.center_settings add constraint center_settings_contact_phone_chk
  check (contact_phone is null or contact_phone ~ '^\+?[0-9][0-9 ]{7,18}[0-9]$');

alter table public.center_settings drop constraint if exists center_settings_contact_email_chk;
alter table public.center_settings add constraint center_settings_contact_email_chk
  check (contact_email is null
         or (length(contact_email) <= 254 and contact_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
             and contact_email = lower(contact_email)));

alter table public.center_settings drop constraint if exists center_settings_notify_email_chk;
alter table public.center_settings add constraint center_settings_notify_email_chk
  check (notify_email is null
         or (length(notify_email) <= 254 and notify_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
             and notify_email = lower(notify_email)));

alter table public.center_settings drop constraint if exists center_settings_address_chk;
alter table public.center_settings add constraint center_settings_address_chk
  check (address is null or (address = btrim(address) and length(address) between 5 and 200));

alter table public.center_settings drop constraint if exists center_settings_legal_name_chk;
alter table public.center_settings add constraint center_settings_legal_name_chk
  check (legal_name is null or (legal_name = btrim(legal_name) and length(legal_name) between 2 and 200));

alter table public.center_settings drop constraint if exists center_settings_tax_id_chk;
alter table public.center_settings add constraint center_settings_tax_id_chk
  check (tax_id is null or tax_id ~ '^[A-Z0-9][A-Z0-9-]{6,13}[A-Z0-9]$');
