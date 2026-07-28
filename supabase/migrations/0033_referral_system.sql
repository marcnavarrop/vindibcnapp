-- ═══════════════════════════════════════════════════════════
-- 0033 · Sistema de referits
-- ═══════════════════════════════════════════════════════════

-- 1. Extend center_settings
ALTER TABLE center_settings
  ADD COLUMN IF NOT EXISTS referral_program_active     boolean        NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS referral_reward_referee     boolean        NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS referral_discount_percent   numeric(5,2)   NOT NULL DEFAULT 10;

-- 2. Extend clients
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS referral_code          text UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by_client_id  uuid REFERENCES clients(id);

-- 3. Helper: generate a short readable code from a full name
--    Character set excludes ambiguous chars: I, L, O, 0, 1
CREATE OR REPLACE FUNCTION generate_referral_code(p_full_name text)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  safe_chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  prefix     text;
  suffix     text;
  candidate  text;
  attempt    int := 0;
BEGIN
  -- First 3 letters of name, uppercase, drop ambiguous chars I/L/O
  prefix := regexp_replace(
    regexp_replace(upper(p_full_name), '[^A-Z]', '', 'g'),
    '[ILO]', '', 'g'
  );
  prefix := left(prefix, 3);
  -- Pad to 3 if the name was short / all-ambiguous
  WHILE length(prefix) < 3 LOOP
    prefix := prefix || substr(safe_chars,
      (floor(random() * length(safe_chars))::int + 1), 1);
  END LOOP;

  LOOP
    suffix := '';
    FOR i IN 1..4 LOOP
      suffix := suffix || substr(safe_chars,
        (floor(random() * length(safe_chars))::int + 1), 1);
    END LOOP;
    candidate := prefix || '-' || suffix;
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM clients WHERE referral_code = candidate
    );
    attempt := attempt + 1;
    -- Fallback after 20 collisions: use partial md5 (very unlikely)
    IF attempt > 20 THEN
      candidate := prefix || '-' || upper(substr(md5(random()::text), 1, 4));
      EXIT;
    END IF;
  END LOOP;

  RETURN candidate;
END;
$$;

-- 4. Trigger: auto-assign referral_code on INSERT
CREATE OR REPLACE FUNCTION clients_set_referral_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  fname text;
BEGIN
  IF NEW.referral_code IS NULL THEN
    SELECT full_name INTO fname FROM profiles WHERE id = NEW.profile_id;
    NEW.referral_code := generate_referral_code(COALESCE(fname, 'USR'));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clients_auto_referral_code ON clients;
CREATE TRIGGER clients_auto_referral_code
  BEFORE INSERT ON clients
  FOR EACH ROW EXECUTE FUNCTION clients_set_referral_code();

-- 5. Backfill existing clients that have no code yet
UPDATE clients c
SET referral_code = generate_referral_code(COALESCE(p.full_name, 'USR'))
FROM profiles p
WHERE c.profile_id = p.id
  AND c.referral_code IS NULL;

-- 6. referral_rewards table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'referral_reward_status') THEN
    CREATE TYPE referral_reward_status AS ENUM ('pending', 'used', 'expired');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS referral_rewards (
  id                    uuid                   PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_client_id    uuid                   NOT NULL REFERENCES clients(id),
  referee_client_id     uuid                   NOT NULL REFERENCES clients(id),
  beneficiary_client_id uuid                   NOT NULL REFERENCES clients(id),
  discount_percent      numeric(5,2)           NOT NULL,
  status                referral_reward_status NOT NULL DEFAULT 'pending',
  used_in_bono_id       uuid                   REFERENCES bonos(id),
  created_at            timestamptz            NOT NULL DEFAULT now()
);

-- 7. RLS
ALTER TABLE referral_rewards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_all_referral_rewards" ON referral_rewards;
CREATE POLICY "staff_all_referral_rewards" ON referral_rewards
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'trainer')
    )
  );

DROP POLICY IF EXISTS "client_own_referral_rewards" ON referral_rewards;
CREATE POLICY "client_own_referral_rewards" ON referral_rewards
  FOR SELECT TO authenticated
  USING (
    beneficiary_client_id IN (
      SELECT id FROM clients WHERE profile_id = auth.uid()
    )
  );
