-- ============================================================================
-- VindiBCN · 0043 — Caducitat dels bons
--
-- Valor GLOBAL del centre en mesos (null = sense caducitat, que és el
-- comportament d'avui). La data concreta es calcula i es DESA al bo en el
-- moment de comprar-lo, i no es recalcula mai més.
--
-- Aquest darrer punt és el mateix criteri d'històric protegit que ja s'aplica a
-- les tarifes, les ofertes i el bonus: si demà el centre canvia la caducitat a
-- 6 mesos, qui va comprar amb 12 conserva els seus 12. El client va pagar sota
-- unes condicions i aquelles condicions no es toquen a posteriori.
-- ============================================================================

alter table public.center_settings
  add column if not exists bono_expiry_months integer
    check (bono_expiry_months is null or bono_expiry_months between 1 and 120);

comment on column public.center_settings.bono_expiry_months is
  'Mesos de validesa d''un bo des de la compra. Null = sense caducitat. Només afecta els bons que es comprin a partir d''ara.';

alter table public.bonos
  add column if not exists expires_at date;

comment on column public.bonos.expires_at is
  'Data de caducitat fixada en COMPRAR el bo (purchased_at + bono_expiry_months d''aleshores). Null = no caduca. No es recalcula si després canvia la configuració.';

-- Consulta dominant del cron i del escombrat: "quins bons caduquen aviat o ja
-- han caducat i encara consten com a utilitzables".
create index if not exists bonos_expiry_lookup
  on public.bonos (expires_at, status)
  where expires_at is not null;

-- ─── Estat nou ──────────────────────────────────────────────────────────────
-- 'expired' i 'completed' no són el mateix i no s'han de barrejar: completat
-- vol dir que s'han fet totes les sessions; caducat, que se n'han perdut de
-- pagades. Qui mira la fitxa d'un client ha de poder distingir-ho.
alter type public.bono_status add value if not exists 'expired';

-- ─── Preferència de l'avís previ ────────────────────────────────────────────
-- Per defecte activat: assabentar-se que un bo pagat és a punt de caducar és
-- informació que el client vol, no una comoditat opcional.
alter table public.notification_preferences
  add column if not exists bono_expiring_soon_email    boolean not null default true,
  add column if not exists bono_expiring_soon_whatsapp boolean not null default false;
