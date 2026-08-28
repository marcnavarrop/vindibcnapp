-- ============================================================================
-- VindiBCN · 0052 — Interruptor de la llista d'espera
--
-- Fins ara la cua només existia dins de l'assistent de reserva en bucle, i el
-- centre no tenia manera de dir-hi res. Ara que s'ofereix també en una reserva
-- normal —quan un grup surt "Complet"— cal poder-la apagar.
--
-- Per defecte activada: el sistema ja funciona i els centres que l'han fet
-- servir no s'han de trobar la cua morta d'un dia per l'altre.
--
-- Apagar-la atura les inscripcions NOVES; les entrades que ja hi són es
-- continuen promocionant quan s'allibera una plaça. Mateix criteri que amb els
-- vals de regal: es tanca la venda, no el que ja s'ha venut. Qui es va apuntar
-- ho va fer amb les regles d'aleshores i el centre li va dir que l'avisaria.
-- ============================================================================

alter table public.center_settings
  add column if not exists waitlist_enabled boolean not null default true;

comment on column public.center_settings.waitlist_enabled is
  'Es pot apuntar gent NOVA a la llista d''espera. Amb false, les entrades existents segueixen promocionant-se igualment.';
