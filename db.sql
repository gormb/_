-- Visit log (db.js logVisit → log_visit RPC); read by log.html.
create table if not exists log (id bigint generated always as identity primary key,ts timestamptz default now(),k text,u text,d jsonb);
create index if not exists log_k_idx on log(k);
create index if not exists log_ts_idx on log(ts desc);
create or replace function public.log_visit(k text,u text,d jsonb)
returns void language sql as $$ insert into log(k,u,d) values(k,u,d); $$;
alter table log enable row level security;
drop policy if exists log_all on log;
create policy log_all on log for all using (true) with check (true);
-- Premum codes (db.js logUsage → log_usage RPC); used by other projects.
create table if not exists codes (code text primary key, book text not null default '', dtfrom timestamptz not null default now(), dtto timestamptz not null default '2099-12-31 23:59:59+00', use_limit integer, mails text not null default '', created_at timestamptz default now());
alter table codes enable row level security;
drop policy if exists codes_all on codes;
create policy codes_all on codes for all using (true) with check (true);
-- Usage log (db.js logUsage → log_usage RPC); used by other projects.
create table if not exists usage (id bigint generated always as identity primary key, fingerprint uuid, session_id uuid, code_id text references codes(code) on delete set null, book text not null default '', page integer, event text not null default '', created_at timestamptz default now());
alter table usage enable row level security;
drop policy if exists usage_all on usage;
create policy usage_all on usage for all using (true) with check (true);
-- Book list (db.js getBooks → get_books RPC); used by other projects
create table if not exists books (book text primary key, deployed text not null default '', prod text not null default '', dtautosyncfrom timestamptz, dtautosyncto timestamptz);
alter table books enable row level security;
drop policy if exists books_all on books;
create policy books_all on books for all using (true) with check (true);
-- Book versions (db.js getBookversions → get_bookversions RPC); used by other projects
create table if not exists book_versions (book text not null default 'ABook', version text not null default 'EN', name text not null default 'Set Name', description text not null default '', created_at timestamptz default now(), primary key(book, version));
alter table book_versions enable row level security;
drop policy if exists book_versions_all on book_versions;
create policy book_versions_all on book_versions for all using (true) with check (true);
