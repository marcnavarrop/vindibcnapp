-- ============================================================================
-- VindiBCN · 0040 — Bonus: biennal de debò i un sol payout per període
--
-- 1) 'biannual' volia dir "dos cops l'any" i el que es vol és "un cop cada dos
--    anys". Es reanomena el valor de l'enum a 'biennial'. RENAME VALUE manté
--    les files existents apuntant al valor reanomenat, així que no cal migrar
--    dades a mà (i, de fet, encara no n'hi ha cap en producció).
--
-- 2) Un període només pot tenir un payout. Fins ara res no impedia tancar dues
--    vegades el mateix any: la garantia ha de ser de la base de dades, no de
--    la UI. Si cal corregir-ne un, s'esborra a mà des de Supabase.
-- ============================================================================

do $$
begin
  if exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'bonus_payout_frequency' and e.enumlabel = 'biannual'
  ) then
    alter type public.bonus_payout_frequency rename value 'biannual' to 'biennial';
  end if;
end $$;

-- Si hi hagués duplicats previs, l'índex fallaria i caldria resoldre'ls abans;
-- amb la taula buida (o sense duplicats) es crea net.
create unique index if not exists bonus_payouts_unique_period
  on public.bonus_payouts (trainer_id, period_start, period_end);

comment on index public.bonus_payouts_unique_period is
  'Un únic payout per professional i període. Per refer-ne un, esborra''l primer.';
