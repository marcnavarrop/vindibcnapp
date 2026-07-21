-- VindiBCN · 0030
-- Afegeix les columnes de preferència per al nou event type manual
-- "new_exercises_assigned" (trainer acciona explícitament → default false).

alter table public.notification_preferences
  add column if not exists new_exercises_assigned_email     boolean not null default false,
  add column if not exists new_exercises_assigned_whatsapp  boolean not null default false;
