-- Canva Connect API — OAuth tokens storage
CREATE TABLE canva_tokens (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  access_token  TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  scope         TEXT,
  user_label    TEXT DEFAULT 'admin',
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE canva_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role only" ON canva_tokens USING (auth.role() = 'service_role');

CREATE TRIGGER set_updated_at BEFORE UPDATE ON canva_tokens
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
