-- ============================================================================
-- VindiBCN · 0057 — Les categories d'exercici deixen de ser un enum
--
-- La 0003 les va fixar com a `exercise_category`: cinc valors, i afegir-ne un
-- volia dir una migració. Qui prescriu els exercicis és qui sap quina
-- categoria li falta, i no pot esperar un desplegament per tenir-la.
--
-- Passen a taula pròpia amb clau forana. El pas delicat és la conversió de la
-- columna: es fa amb una columna nova, s'omple, i només llavors es canvia la
-- vella. Res d'`alter column type ... using`, que amb un enum obligaria a
-- convertir a text pel mig i deixaria la taula sense garanties enmig de la
-- migració.
--
-- ON DELETE RESTRICT a posta: esborrar una categoria en ús ha de fallar. Ja es
-- comprova a l'aplicació i s'hi ensenya quants exercicis la fan servir, però
-- la garantia de debò és aquesta —el mateix criteri que amb l'aforament dels
-- grups i la idempotència de Stripe: la base, no el codi.
-- ============================================================================

-- ─── a) La taula ────────────────────────────────────────────────────────────

create table if not exists public.exercise_categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  created_at timestamptz not null default now()
);

comment on table public.exercise_categories is
  'Categories d''exercici, gestionables per admin i professional. Abans eren l''enum exercise_category (0003).';

-- ─── b) Les que ja hi havia ─────────────────────────────────────────────────
--
-- Amb els noms tal com es veien a la interfície (labels.ts), no amb els
-- identificadors de l'enum: a partir d'ara el nom ÉS el que llegeix la gent, i
-- ningú ha de veure "rehabilitacio" en un desplegable. Porten accents perquè
-- ara són dades d'usuari, no identificadors: la nota de la 0003 sobre no posar
-- accents al SQL parlava dels valors de l'enum.

insert into public.exercise_categories (name)
values ('Força'), ('Mobilitat'), ('Cardio'), ('Rehabilitació'), ('Core')
on conflict (name) do nothing;

-- ─── c) La conversió de la columna ──────────────────────────────────────────

alter table public.exercises add column if not exists category_id uuid;

update public.exercises e
   set category_id = c.id
  from public.exercise_categories c
 where c.name = case e.category::text
                  when 'forca'         then 'Força'
                  when 'mobilitat'     then 'Mobilitat'
                  when 'cardio'        then 'Cardio'
                  when 'rehabilitacio' then 'Rehabilitació'
                  when 'core'          then 'Core'
                end
   and e.category_id is null;

-- Xarxa de seguretat: si algun exercici s'hagués quedat sense categoria, la
-- migració s'atura aquí en comptes de deixar la taula a mitges.
do $$
declare n integer;
begin
  select count(*) into n from public.exercises where category_id is null;
  if n > 0 then
    raise exception 'Hi ha % exercicis sense categoria convertida: es cancel·la.', n;
  end if;
end $$;

alter table public.exercises drop column category;
alter table public.exercises rename column category_id to category;

alter table public.exercises
  alter column category set not null,
  add constraint exercises_category_fkey
    foreign key (category) references public.exercise_categories (id)
    on delete restrict;

-- La biblioteca es filtra per categoria a cada càrrega.
create index if not exists exercises_category_idx on public.exercises (category);

comment on column public.exercises.category is
  'FK a exercise_categories. RESTRICT: una categoria amb exercicis no es pot esborrar.';

-- ─── d) Qui la pot tocar ────────────────────────────────────────────────────
--
-- Mateix patró que `exercises` (0003): llegir-les qualsevol autenticat —el
-- client també veu la categoria dels seus exercicis—, i escriure-les els
-- mateixos que mantenen la biblioteca.

alter table public.exercise_categories enable row level security;

drop policy if exists "exercise_categories_select" on public.exercise_categories;
create policy "exercise_categories_select" on public.exercise_categories
  for select using (auth.uid() is not null);

drop policy if exists "exercise_categories_write" on public.exercise_categories;
create policy "exercise_categories_write" on public.exercise_categories
  for all
  using (public.current_role() in ('admin', 'trainer'))
  with check (public.current_role() in ('admin', 'trainer'));

-- ─── e) L'enum ja no el fa servir ningú ─────────────────────────────────────

drop type if exists public.exercise_category;
