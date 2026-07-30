-- ============================================================================
-- VindiBCN · 0036 — Cinc ajustos nous del centre
--
-- Segueix el patró de center_settings: columnes planes, NOT NULL amb DEFAULT
-- igual al comportament actual, de manera que aplicar la migració no canvia
-- res fins que l'admin toqui la configuració.
--
-- Els mòduls van en tres booleans i no en un jsonb: la resta de la taula ja és
-- plana, el tipus queda comprovat a la base de dades (una clau mal escrita dins
-- d'un jsonb falla en silenci) i types/database.ts es manté a mà, on un Json
-- genèric es desincronitzaria de seguida. El conjunt de mòduls és tancat.
-- ============================================================================

alter table public.center_settings
  -- Horari del centre. Governa el rang d'hores de TOTS els calendaris.
  add column if not exists opening_time time    not null default '07:00',
  add column if not exists closing_time time    not null default '22:00',

  -- Antelació mínima per RESERVAR (diferent de min_cancellation_hours, que és
  -- per cancel·lar). 0 = sense restricció, el comportament d'abans.
  add column if not exists min_booking_hours integer not null default 0,

  -- A partir de quantes sessions restants un bo es considera "a punt
  -- d'esgotar-se" (avís bono_low + KPI del panell). 1 = comportament d'abans.
  add column if not exists bono_low_threshold integer not null default 1,

  -- Hora local del centre a partir de la qual s'envien els recordatoris.
  -- Vegeu la limitació documentada a app/api/cron/reminders/route.ts.
  add column if not exists reminder_hour_local integer not null default 20,

  -- Mòduls que es poden amagar de la navegació i bloquejar per URL.
  add column if not exists module_comunitat_enabled      boolean not null default true,
  add column if not exists module_sessions_prova_enabled boolean not null default true,
  add column if not exists module_documents_enabled      boolean not null default true;

-- Rangs raonables: eviten configuracions que trencarien els calendaris.
alter table public.center_settings
  drop constraint if exists center_settings_hours_order;
alter table public.center_settings
  add constraint center_settings_hours_order check (closing_time > opening_time);

alter table public.center_settings
  drop constraint if exists center_settings_min_booking_hours_range;
alter table public.center_settings
  add constraint center_settings_min_booking_hours_range
  check (min_booking_hours between 0 and 720);

alter table public.center_settings
  drop constraint if exists center_settings_bono_low_threshold_range;
alter table public.center_settings
  add constraint center_settings_bono_low_threshold_range
  check (bono_low_threshold between 0 and 50);

alter table public.center_settings
  drop constraint if exists center_settings_reminder_hour_range;
alter table public.center_settings
  add constraint center_settings_reminder_hour_range
  check (reminder_hour_local between 0 and 23);

comment on column public.center_settings.min_booking_hours is
  'Antelació mínima en hores per crear una reserva. 0 = sense restricció.';
comment on column public.center_settings.bono_low_threshold is
  'Sessions restants a partir de les quals un bo es considera a punt d''esgotar-se.';
comment on column public.center_settings.reminder_hour_local is
  'Hora local del centre a partir de la qual el cron diari envia recordatoris.';
