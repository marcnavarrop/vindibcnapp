-- ============================================================================
-- VindiBCN · 0011 — Catàleg de paquets reals
--
-- Substitueix les 4 files de mostra (0002) per diversos paquets per tipus de
-- servei, amb els preus reals auditats del negoci. La taula `services` ja
-- admet diverses files amb el mateix service_type, així que no cal canvi
-- d'esquema. L'ordre dins d'un servei es deriva de default_sessions.
--
-- Nota de negoci: 'grupo_reducido' NO té "Sessió única" a propòsit (és una
-- incoherència coneguda que el gestor decidirà més endavant).
-- ============================================================================

-- 1. Esborra les 4 files de mostra (per nom; els nous paquets tenen altres noms).
delete from public.services
where name in (
  'Entrenament personal individual',
  'Entrenament personal en parella',
  'Grup reduït',
  'Fisioteràpia'
);

-- 2. Paquets reals.
insert into public.services (service_type, name, price, default_sessions) values
  ('ep_individual',  'Sessió única',   55,  1),
  ('ep_individual',  'Bo 4 sessions',  190, 4),
  ('ep_individual',  'Bo 8 sessions',  360, 8),
  ('ep_parejas',     'Sessió única',   65,  1),
  ('ep_parejas',     'Bo 4 sessions',  240, 4),
  ('ep_parejas',     'Bo 8 sessions',  450, 8),
  ('grupo_reducido', 'Bo 2 sessions',  50,  2),
  ('grupo_reducido', 'Bo 4 sessions',  80,  4),
  ('grupo_reducido', 'Bo 8 sessions',  140, 8),
  ('fisioterapia',   'Sessió única',   50,  1),
  ('fisioterapia',   'Bo 5 sessions',  225, 5),
  ('fisioterapia',   'Bo 10 sessions', 420, 10);
