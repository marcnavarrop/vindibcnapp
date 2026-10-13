-- 0111 · Fora `clients.clinical_notes`
--
-- La 0110 va passar les notes clíniques a l'historial clínic (taules pròpies,
-- sense accés per al client) i l'app ja no llegeix ni escriu aquesta columna.
-- Però la columna seguia legible pel client per l'API: la RLS de `clients` és
-- per fila i no per columna (comprovat el 12/10/2026 amb el Client Demo).
--
-- PER QUÈ ES TREU I NO NOMÉS ES TANCA
--
-- Un `revoke select (clinical_notes)` no fa res mentre `authenticated` tingui
-- `select` sobre tota la taula. Per tancar-la de debò caldria treure el
-- `select` de la taula i tornar a donar-lo columna per columna, i cada columna
-- nova que s'afegís a `clients` en el futur quedaria fora sense que ningú
-- se n'adonés. Buidar-la i esborrar-la no deixa res per oblidar.
--
-- SALVAGUARDA
--
-- Abans de res, es comprova que cap nota amb contingut s'hagi quedat sense la
-- seva «Primera visita» (la còpia de la 0110). Si n'hi ha cap, la migració
-- s'atura i no toca res. A producció, el 13/10/2026, n'hi havia 0.
--
-- Sense `cascade`: si alguna vista o funció depengués de la columna, el
-- `drop` fallaria i ho diria, en lloc d'endur-se-la.

begin;

do $$
declare
  n int;
begin
  select count(*) into n
  from public.clients c
  where nullif(btrim(c.clinical_notes), '') is not null
    and not exists (
      select 1 from public.clinical_first_visits f where f.client_id = c.id
    );
  if n > 0 then
    raise exception '0111: % clients tenen notes clíniques sense «Primera visita». No es toca res.', n;
  end if;
end
$$;

update public.clients
   set clinical_notes = null
 where clinical_notes is not null;

alter table public.clients drop column clinical_notes;

commit;
