create table if not exists public.restablecimientos_contrasena (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.users (id) on delete cascade,
  token_hash text not null unique,
  expira_en timestamptz not null,
  usado_en timestamptz,
  creado_en timestamptz not null default now()
);

create index if not exists restablecimientos_contrasena_usuario_id_idx
  on public.restablecimientos_contrasena (usuario_id);

alter table public.restablecimientos_contrasena enable row level security;
revoke all on public.restablecimientos_contrasena from anon, authenticated;
grant all on public.restablecimientos_contrasena to service_role;

create or replace function public.buscar_usuario_recuperacion_por_email(p_email text)
returns table (id uuid, email text)
language sql
stable
security definer
set search_path = ''
as $$
  select usuarios.id, usuarios.email
  from public.users as usuarios
  where lower(usuarios.email) = lower(p_email)
  limit 1;
$$;

create or replace function public.contar_solicitudes_restablecimiento(p_usuario_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)
  from public.restablecimientos_contrasena
  where usuario_id = p_usuario_id
    and creado_en >= now() - interval '15 minutes';
$$;

create or replace function public.buscar_token_restablecimiento_vigente(p_token_hash text)
returns setof public.restablecimientos_contrasena
language sql
stable
security definer
set search_path = ''
as $$
  select *
  from public.restablecimientos_contrasena
  where token_hash = p_token_hash
    and usado_en is null
    and expira_en > now();
$$;

create or replace function public.marcar_token_restablecimiento_usado(p_token_id uuid)
returns setof public.restablecimientos_contrasena
language sql
volatile
security definer
set search_path = ''
as $$
  update public.restablecimientos_contrasena
  set usado_en = now()
  where id = p_token_id
    and usado_en is null
    and expira_en > now()
  returning *;
$$;

revoke all on function public.buscar_usuario_recuperacion_por_email(text) from public, anon, authenticated;
revoke all on function public.contar_solicitudes_restablecimiento(uuid) from public, anon, authenticated;
revoke all on function public.buscar_token_restablecimiento_vigente(text) from public, anon, authenticated;
revoke all on function public.marcar_token_restablecimiento_usado(uuid) from public, anon, authenticated;
grant execute on function public.buscar_usuario_recuperacion_por_email(text) to service_role;
grant execute on function public.contar_solicitudes_restablecimiento(uuid) to service_role;
grant execute on function public.buscar_token_restablecimiento_vigente(text) to service_role;
grant execute on function public.marcar_token_restablecimiento_usado(uuid) to service_role;
