-- ============================================================
--  Member payments — "Give Payment" requests + manager confirmation
--  Run against the SHARED Supabase project: Dashboard → SQL Editor → Run.
--  Safe to re-run.
--
--  A member submits a request (status = 'pending'). Nothing is credited to
--  rent / utility / meals until a manager or sub-manager confirms it in the
--  app, which then applies the payment and stamps this row 'confirmed'.
--
--  Row-level security uses the same JWT claims as supabase/rls-policies.sql
--  (mess_id, member_id, role). Requires get_mess_id_from_jwt() /
--  get_role_from_jwt() from that file.
-- ============================================================

create extension if not exists "uuid-ossp";

create table if not exists member_payments (
  id             uuid primary key default uuid_generate_v4(),
  receipt_no     bigint generated always as identity,
  mess_id        uuid not null references messes(id)  on delete cascade,
  member_id      uuid not null references members(id) on delete cascade,
  member_name    text not null,
  month_key      text not null,
  month          smallint not null,
  year           integer  not null,
  amount         numeric(12,2) not null check (amount > 0),
  due_at_submit  numeric(12,2),
  status         text not null default 'pending'
                 check (status in ('pending', 'confirmed', 'rejected')),
  split          jsonb,
  still_due      numeric(12,2),
  confirmed_by   text,
  confirmed_at   timestamptz,
  created_at     timestamptz not null default now()
);

create index if not exists idx_member_payments_mess   on member_payments(mess_id, status, created_at);
create index if not exists idx_member_payments_member on member_payments(member_id, created_at);

alter table member_payments enable row level security;

drop policy if exists "mm_member_payments_select" on member_payments;
drop policy if exists "mm_member_payments_insert" on member_payments;
drop policy if exists "mm_member_payments_update" on member_payments;

-- Managers see every payment in their mess; a member sees only their own.
create policy "mm_member_payments_select" on member_payments
  for select using (
    mess_id = get_mess_id_from_jwt()
    and (
      get_role_from_jwt() in ('manager', 'sub_manager', 'superadmin')
      or member_id::text = current_setting('request.jwt.claims', true)::json->>'member_id'
    )
  );

-- A member may file a *pending* request for themselves only.
create policy "mm_member_payments_insert" on member_payments
  for insert with check (
    mess_id = get_mess_id_from_jwt()
    and status = 'pending'
    and member_id::text = current_setting('request.jwt.claims', true)::json->>'member_id'
  );

-- Only managers / sub-managers can confirm or reject.
create policy "mm_member_payments_update" on member_payments
  for update using (
    mess_id = get_mess_id_from_jwt()
    and get_role_from_jwt() in ('manager', 'sub_manager', 'superadmin')
  );

-- ---- verify ----
-- select count(*) from member_payments;
