-- ============================================================================
-- VindiBCN · 0041 — Factures de liquidació (document + accés del professional)
--
-- EINA DE CÀLCUL INTERN, com la resta de Facturació. El PDF que es genera porta
-- imprès l'avís de "document provisional": el format oficial l'ha de confirmar
-- l'assessoria. Aquesta migració NO li dona validesa fiscal, només guarda on
-- viu el fitxer i qui el pot llegir.
--
-- Tres canvis:
--   1) settlements.invoice_path — ruta del PDF al Storage (null = sense factura).
--   2) Bucket privat 'settlement-invoices'.
--   3) OBERTURA EXPLÍCITA DE RLS: fins ara les liquidacions només les veia
--      l'admin (0037 deia que qualsevol obertura havia de ser una decisió
--      conscient). Ho és: el professional ha de poder consultar i descarregar
--      les seves pròpies factures. Segueix sense veure les dels companys, i
--      escriure continua sent només d'admin.
-- ============================================================================

alter table public.settlements
  add column if not exists invoice_path text;

comment on column public.settlements.invoice_path is
  'Ruta al bucket settlement-invoices ({trainer_id}/{settlement_id}.pdf). Null = encara no s''ha generat el document.';

-- ─── Bucket privat ──────────────────────────────────────────────────────────
-- Mateix criteri que client-documents: privat sempre, accés per signed URL
-- generada al servidor després de comprovar qui la demana.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'settlement-invoices',
  'settlement-invoices',
  false,
  5242880, -- 5 MB: un PDF d'una pàgina no s'hi acosta
  array['application/pdf']
)
on conflict (id) do nothing;

-- Storage RLS. A la pràctica el codi hi entra amb el client de servei (que se
-- la salta) i serveix el fitxer amb signed URL, però les polítiques hi són com
-- a segona barrera per si algun dia s'hi accedeix amb el client de sessió.
-- Convenció de ruta: {trainer_id}/{settlement_id}.pdf

drop policy if exists "storage_settlement_invoices_select" on storage.objects;
create policy "storage_settlement_invoices_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'settlement-invoices'
    and (
      public.is_admin()
      or split_part(name, '/', 1) = auth.uid()::text
    )
  );

drop policy if exists "storage_settlement_invoices_insert" on storage.objects;
create policy "storage_settlement_invoices_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'settlement-invoices' and public.is_admin());

drop policy if exists "storage_settlement_invoices_update" on storage.objects;
create policy "storage_settlement_invoices_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'settlement-invoices' and public.is_admin())
  with check (bucket_id = 'settlement-invoices' and public.is_admin());

drop policy if exists "storage_settlement_invoices_delete" on storage.objects;
create policy "storage_settlement_invoices_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'settlement-invoices' and public.is_admin());

-- ─── Lectura de la pròpia liquidació ────────────────────────────────────────
-- Només SELECT i només la pròpia fila. Insert/update/delete continuen sent
-- exclusius de l'admin (les polítiques de 0037 no es toquen).

drop policy if exists "settlements_select" on public.settlements;
create policy "settlements_select"
  on public.settlements for select
  to authenticated
  using (public.is_admin() or trainer_id = auth.uid());

comment on table public.settlements is
  'Liquidacions generades: fotografia fixa del càlcul d''un període. No es recalculen si canvien les tarifes. El professional pot llegir les seves; escriure-hi, només l''admin.';
