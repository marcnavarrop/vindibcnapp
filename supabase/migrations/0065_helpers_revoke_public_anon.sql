-- ============================================================================
-- VindiBCN · 0065 — Els cinc ajudants de rol, tancats com la resta
--
-- La 0061 va deixar-ho escrit: "el `grant` no serveix de res sense el `revoke`
-- de davant". Es va aplicar a `poll_option_counts` i prou. Els cinc ajudants
-- de la 0001 i la 0005 —que no els havia tocat ningú des del primer dia— van
-- quedar tal com neix qualsevol funció a Postgres: amb EXECUTE per a PUBLIC, i
-- per tant a l'abast de l'anònim. El comentari de la 0061 ja ho deia de
-- passada, citant `is_admin()` com a prova. Aquesta migració ho tanca.
--
-- QUÈ NO ERA
--
-- No era una fuita. Les cinc es resolen contra `auth.uid()`: sense sessió
-- tornen NULL o false, i amb sessió només diuen coses de qui pregunta
-- ("sóc admin?", "aquest client és meu?"). Comprovat cridant-les amb la clau
-- anon: `current_role()` → null, `is_admin()` → null, `is_trainer()` → false,
-- `owns_client(<uuid qualsevol>)` → false, `is_trainer_of(<uuid>)` → false.
-- Això és higiene, no un forat.
--
-- EL `grant` A `authenticated` ÉS LA PART QUE AGUANTA TOT
--
-- Aquestes cinc no són funcions que cridi l'aplicació: viuen DINS de les
-- polítiques de RLS, i n'hi ha unes dues-centes crides repartides per tot
-- l'esquema. Una policy s'avalua amb els privilegis de qui consulta, o sigui
-- que sense aquest `grant` cada SELECT d'un usuari identificat petaria amb un
-- 42501 en comptes de filtrar files. El `revoke` sol seria catastròfic.
--
-- I PER QUÈ ES POT REVOCAR D'`anon` SENSE TRENCAR RES
--
-- Perquè cap camí sense sessió consulta una taula amb RLS fent servir la clau
-- anon. S'ha comprovat un per un abans d'escriure això:
--
--   · `getViewer()` (lib/auth.ts) fa `if (!user) return null` ABANS de tocar
--     `profiles`.
--   · El middleware fa el mateix: `if (!user) return redirect(...)` abans de
--     la seva consulta a `profiles`.
--   · La pàgina pública /prova i `getCenterSettings()` van per `service_role`
--     (trial-bookings.ts i center-settings.ts no fan servir la sessió), i
--     `service_role` se salta la RLS: no arriba a avaluar cap policy.
--   · Les dues consultes a `profiles` de rutes públiques —el login i el canvi
--     de contrasenya— passen DESPRÉS d'autenticar-se, ja com a `authenticated`.
--
-- Si demà apareix una pàgina pública que llegeixi una taula amb RLS amb la
-- clau anon, el símptoma serà un 42501 ben visible, no una fuita silenciosa.
-- És l'error que es vol tenir.
-- ============================================================================

-- current_role()
revoke execute on function public.current_role() from public;
revoke execute on function public.current_role() from anon;
grant  execute on function public.current_role() to authenticated;

-- is_admin()
revoke execute on function public.is_admin() from public;
revoke execute on function public.is_admin() from anon;
grant  execute on function public.is_admin() to authenticated;

-- is_trainer()
revoke execute on function public.is_trainer() from public;
revoke execute on function public.is_trainer() from anon;
grant  execute on function public.is_trainer() to authenticated;

-- owns_client(uuid)
revoke execute on function public.owns_client(uuid) from public;
revoke execute on function public.owns_client(uuid) from anon;
grant  execute on function public.owns_client(uuid) to authenticated;

-- is_trainer_of(uuid)
revoke execute on function public.is_trainer_of(uuid) from public;
revoke execute on function public.is_trainer_of(uuid) from anon;
grant  execute on function public.is_trainer_of(uuid) to authenticated;
