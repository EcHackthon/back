-- public.users 테이블 생성 (구글 로그인 사용자 정보 저장용)

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  name text,
  picture text,
  google_sub text unique,  -- 구글 사용자 ID
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- updated_at 자동 업데이트 함수
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- updated_at 트리거
drop trigger if exists update_users_updated_at on public.users;
create trigger update_users_updated_at
  before update on public.users
  for each row
  execute function update_updated_at_column();

-- RLS 활성화
alter table public.users enable row level security;

-- 모든 사용자는 자신의 정보만 읽을 수 있음
create policy "users_select_own"
on public.users
for select
to authenticated
using (auth.uid() = id);

-- 모든 사용자는 자신의 정보만 업데이트할 수 있음
create policy "users_update_own"
on public.users
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- Service Role로만 삽입 가능 (서버 사이드에서만)
create policy "users_insert_service_role"
on public.users
for insert
to service_role
with check (true);

-- Service Role로만 업데이트 가능 (서버 사이드에서만)
create policy "users_update_service_role"
on public.users
for update
to service_role
with check (true);

-- 인덱스 생성
create index if not exists idx_users_email on public.users(email);
create index if not exists idx_users_google_sub on public.users(google_sub);

