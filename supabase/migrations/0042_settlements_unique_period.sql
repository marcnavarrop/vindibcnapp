-- ============================================================================
-- VindiBCN · 0042 — Una sola liquidació per professional i període
--
-- Mateix criteri que 0040 va aplicar als bonus: una liquidació és la fotografia
-- del càlcul d'un període, i un període no es pot tancar dues vegades. Fins ara
-- només ho advertia la UI, i una advertència no és una garantia: dos clics
-- seguits, dues pestanyes obertes o una acció repetida creaven dues
-- liquidacions del mateix període, cadascuna amb la seva factura i el seu
-- correu al professional. La garantia ha de ser de la base de dades.
--
-- Comprovat abans d'escriure-la: producció no té cap duplicat (de fet, cap
-- liquidació), així que l'índex es crea net. Si en un altre entorn en tingués,
-- el `create unique index` fallaria i caldria resoldre'ls primer — a propòsit,
-- perquè triar quina fila es queda no és una decisió que hagi de prendre una
-- migració.
--
-- Per refer una liquidació: esborrar-la a mà des de Supabase (i el seu PDF del
-- bucket settlement-invoices) i tornar-la a generar.
-- ============================================================================

create unique index if not exists settlements_unique_period
  on public.settlements (trainer_id, period_start, period_end);

comment on index public.settlements_unique_period is
  'Una única liquidació per professional i període. Per refer-ne una, esborra-la primer (i el PDF del bucket).';
