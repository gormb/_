-- Visit log (db.js logVisit → log_visit RPC); read by log.html.
create table if not exists log (
  id bigint generated always as identity primary key,
  ts timestamptz default now(),
  k text,
  u text,
  d jsonb
);
create index if not exists log_k_idx on log(k);
create index if not exists log_ts_idx on log(ts desc);
create or replace function public.log_visit(k text,u text,d jsonb)
returns void language sql as $$ insert into log(k,u,d) values(k,u,d); $$;
-- RLS open for admin.
alter table log enable row level security;
create policy log_all on log for all using (true) with check (true);
-- Note: unquoted identifiers fold to lowercase.

create table if not exists codes (
  code text primary key,
  book text not null default '',
  dtfrom timestamptz not null default now(),
  dtto timestamptz not null default '2099-12-31 23:59:59+00',
  use_limit integer,
  mails text not null default '',
  created_at timestamptz default now()
);
-- Existing table: add missing columns if needed:
-- alter table codes add column if not exists use_limit integer;
-- alter table codes add column if not exists created_at timestamptz default now();
-- RLS open for admin.
alter table codes enable row level security;
create policy codes_all on codes for all using (true) with check (true);
-- Note: unquoted identifiers fold to lowercase (dtfrom/dtto).
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
-- RLS open for admin.
alter table usage enable row level security;
create policy usage_all on usage for all using (true) with check (true);
-- Note: usage written by db.js logUsage; logic in code, not SQL.
create table if not exists books (
  book text primary key,
  deployed text not null default '',
  prod text not null default '',
  dtautosyncfrom timestamptz,
  dtautosyncto timestamptz
);
-- RLS open for admin.
alter table books enable row level security;
create policy books_all on books for all using (true) with check (true);
-- Note: unquoted identifiers fold to lowercase (dtautosyncfrom/dtautosyncto).