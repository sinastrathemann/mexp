-- Dev-User für lokale Entwicklung
-- Run with: psql -U mexp -d mexp -f seed-dev-user.sql

INSERT INTO public.users (id, email, display_name, password_hash, is_active, created_at)
VALUES (
  'dev-user-sina',
  'sina.strathemann@mindsquare.de',
  'Sina Strathemann',
  '$2b$12$tN.pR8qVjrH.6E5/vCq4N.pOLZZZq5zZ5zZ5zZ5zZ5zZ5zZ5zZ5zZ', -- password: "password"
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, is_active = true;

-- Grant admin role
INSERT INTO public.user_roles (user_id, role)
VALUES ('dev-user-sina', 'admin')
ON CONFLICT DO NOTHING;
