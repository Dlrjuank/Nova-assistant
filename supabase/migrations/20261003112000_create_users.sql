create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.users enable row level security;

revoke all on public.users from anon, authenticated;
grant select on public.users to authenticated;

drop policy if exists "Users can read their own account" on public.users;
create policy "Users can read their own account"
  on public.users
  for select
  to authenticated
  using ((select auth.uid()) = id);

create or replace function public.handle_auth_user_public_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_public_account_created on auth.users;
create trigger on_auth_user_public_account_created
  after insert or update of email on auth.users
  for each row execute function public.handle_auth_user_public_account();

insert into public.users (id, email, created_at)
select id, email, created_at
from auth.users
on conflict (id) do update
  set email = excluded.email,
      updated_at = now();
