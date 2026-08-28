create table if not exists codes (
  code text primary key,
  book text not null default '',
  dtfrom timestamptz not null default now(),
  dtto timestamptz not null default '2099-12-31 23:59:59+00',
  use_limit integer,
  mails text not null default '',
  created_at timestamptz default now()
);
-- Eksisterende tabell: legg til manglende kolonner:
-- alter table codes add column if not exists use_limit integer;
-- alter table codes add column if not exists created_at timestamptz default now();
-- RLS (open for the admin page):
alter table codes enable row level security;
create policy codes_all on codes for all using (true) with check (true);
-- NB: unquoted identifiers are folded to lowercase (dtfrom/dtto).
create table if not exists usage (
  id bigint generated always as identity primary key,
  fingerprint uuid,
  session_id uuid,
  code_id text references codes(code) on delete set null,
  book text not null default '',
  page integer,
  event text not null default '',
  created_at timestamptz default now()
);
-- RLS (open for the admin page):
alter table usage enable row level security;
create policy usage_all on usage for all using (true) with check (true);
-- NB: appen skriver herfra (db.js logUsage) – logikk i kode, ikke i SQL.
create table if not exists books (
  book text primary key,
  deployed text not null default '',
  prod text not null default '',
  dtautosyncfrom timestamptz,
  dtautosyncto timestamptz
);
-- RLS (open for the admin page):
alter table books enable row level security;
create policy books_all on books for all using (true) with check (true);
-- NB: unquoted identifiers are folded to lowercase (dtautosyncfrom/dtautosyncto).