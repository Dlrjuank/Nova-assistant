alter table public.users
  add column if not exists full_name text not null default '',
  add column if not exists phone text not null default '';

alter table public.users
  alter column full_name set default '',
  alter column phone set default '';
