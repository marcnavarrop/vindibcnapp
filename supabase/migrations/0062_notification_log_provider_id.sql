-- ============================================================================
-- VindiBCN · 0062 — Guardar l'identificador que torna el proveïdor de correu
--
-- `notification_log.status` diu 'sent' quan Resend ACCEPTA la petició, que no
-- és el mateix que entregar-la. Un correu suprimit o rebotat hi consta com a
-- 'sent' exactament igual que un que ha arribat.
--
-- Això va passar de debò: un recordatori constava com a enviat i Resend
-- l'havia descartat perquè l'adreça era a la seva llista de supressió. Per
-- trobar-ho es va haver de creuar a mà per data i destinatari contra el seu
-- historial, perquè l'identificador que ens torna en enviar no es desava.
--
-- Amb aquesta columna, l'estat real d'un correu és una consulta directa:
--   https://api.resend.com/emails/<provider_id>
--
-- El nom és `provider_id` i no `resend_id` perquè el que hi ha a sota és
-- l'adaptador d'un canal: el dia que el correu surti per un altre proveïdor,
-- la columna segueix volent dir el mateix.
-- ============================================================================

alter table public.notification_log
  add column if not exists provider_id text;

comment on column public.notification_log.provider_id is
  'Id que retorna el proveïdor de correu en acceptar l''enviament (Resend). Serveix per consultar-hi l''estat real d''entrega: "sent" aquí només vol dir acceptat.';

-- Buscar per id quan arriba un avís d'entrega o de rebot.
create index if not exists notification_log_provider_id_idx
  on public.notification_log (provider_id)
  where provider_id is not null;
