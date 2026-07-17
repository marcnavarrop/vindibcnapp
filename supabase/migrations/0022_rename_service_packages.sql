-- ============================================================================
-- VindiBCN · 0022 — Homogeneïtzar el nom dels paquets de serveis
--
-- "Bo X sessions" → "Bo de X sessions" (afegir "de"). "Sessió única" NO es toca.
-- NOMÉS es canvia el nom; preus i sessions queden intactes.
-- ============================================================================
update public.services
set name = 'Bo de ' || substr(name, 4)
where name like 'Bo %';
