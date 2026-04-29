-- Server-side Google OAuth refresh tokens (AES encrypted application-side).
-- scope_key matches sprint.org_id when set; otherwise sprint primary id for workspace isolation.

create table if not exists google_oauth_tokens (
  scope_key uuid primary key,
  encrypted_refresh_token text not null,
  google_email text,
  scopes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_google_oauth_tokens_updated on google_oauth_tokens(updated_at desc);

comment on table google_oauth_tokens is 'Encrypted Google OAuth refresh tokens for Sheets + Gmail; never expose to client';
