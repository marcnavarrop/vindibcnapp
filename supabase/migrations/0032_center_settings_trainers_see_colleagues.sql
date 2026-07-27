-- Nou ajust de centre: controla si els entrenadors veuen les reserves dels companys.
alter table public.center_settings
  add column trainers_see_colleagues_reservations boolean not null default true;
