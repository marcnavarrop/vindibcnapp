-- ============================================================================
-- VindiBCN · 0061 — Ara sí: treure-li el permís a l'anònim
--
-- La 0060 no va servir de res, i val la pena deixar escrit per què.
--
-- `revoke ... from public` treu el permís que Postgres dóna a tothom en crear
-- una funció. Però aquest projecte, com tots els de Supabase, té DEFAULT
-- PRIVILEGES que donen EXECUTE a `anon` i `authenticated` sobre les funcions
-- noves de l'esquema public. Això és un grant DIRECTE al rol `anon`, i el
-- `revoke` de PUBLIC no el toca: són dues concessions diferents.
--
-- Comprovat: després d'aplicar la 0060 la crida anònima seguia passant. I la
-- prova que ho confirma és que `is_admin()` —de la 0001, que no ha tocat
-- ningú— també la pot cridar l'anònim. No era cosa de la 0059: és com neix
-- qualsevol funció aquí.
--
-- El patró bo ja era al repositori. La 0053, amb `book_group_slot`, revoca de
-- public, d'anon I d'authenticated abans de donar el permís a qui toca. Això
-- és el que calia copiar des del principi.
-- ============================================================================

revoke execute on function public.poll_option_counts(uuid[]) from public;
revoke execute on function public.poll_option_counts(uuid[]) from anon;
grant  execute on function public.poll_option_counts(uuid[]) to authenticated;
