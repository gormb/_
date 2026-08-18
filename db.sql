create table if not exists public.redir (id text primary key,url text not null,"desc" text,"group" text,sort numeric);
create table if not exists public.log (id bigint generated always as identity primary key,ts timestamptz default now(),k text,u text,d jsonb);
create or replace function public.log_visit(k text,u text,d jsonb) returns void language sql as $$ insert into public.log(k,u,d) values(k,u,d); $$;
--alter table public.redir add column if not exists "group" text;
--alter table public.redir add column if not exists sort numeric;