-- RLS 정책 성능 최적화: auth.uid()를 (select auth.uid())로 변경

-- 기존 정책 삭제
drop policy if exists "read_own" on public.recommendations;
drop policy if exists "insert_own" on public.recommendations;
drop policy if exists "update_own" on public.recommendations;
drop policy if exists "delete_own" on public.recommendations;

-- 최적화된 정책 재생성
-- 본인 것만 읽기 (성능 최적화)
create policy "read_own"
on public.recommendations
for select to authenticated
using ((select auth.uid()) = user_id);

-- 본인 것만 쓰기 (성능 최적화)
create policy "insert_own"
on public.recommendations
for insert to authenticated
with check ((select auth.uid()) = user_id);

-- 본인 것만 수정 (성능 최적화)
create policy "update_own"
on public.recommendations
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

-- 본인 것만 삭제 (성능 최적화)
create policy "delete_own"
on public.recommendations
for delete to authenticated
using ((select auth.uid()) = user_id);

