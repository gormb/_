-- Kjor i Supabase Dashboard > SQL Editor.
create table if not exists public.redir (
    id    text primary key,
    url   text not null,
    "desc" text
);
