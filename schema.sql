-- ============================================================
-- DealIQ Database Schema
-- Run this in your Supabase SQL editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── USERS ──────────────────────────────────────────────────
create table users (
  id uuid primary key default uuid_generate_v4(),
  email text unique not null,
  name text,
  company text,
  slack_webhook_url text,
  gmail_access_token text,
  gmail_refresh_token text,
  created_at timestamptz default now()
);

-- ── DEALS ──────────────────────────────────────────────────
create table deals (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  company text not null,
  contact_name text not null,
  contact_email text not null,
  contact_role text,
  value numeric,
  stage text default 'Discovery',
  notes text,
  days_stale integer default 0,
  last_activity_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── SIGNALS ────────────────────────────────────────────────
create table signals (
  id uuid primary key default uuid_generate_v4(),
  deal_id uuid references deals(id) on delete cascade,
  source text not null, -- gmail | slack | linkedin | crm | intent
  type text not null,
  summary text not null,
  sentiment text default 'neutral', -- positive | negative | neutral
  detected_at timestamptz default now()
);

-- ── ANALYSES ───────────────────────────────────────────────
create table analyses (
  id uuid primary key default uuid_generate_v4(),
  deal_id uuid references deals(id) on delete cascade,
  risk_level text not null,    -- high | medium | low
  close_score integer not null, -- 0-100
  stall_reason text,
  insight text,
  recommended_action text,
  urgency text,                -- immediate | this_week | monitor
  draft_email_subject text,
  draft_email_body text,
  signal_count integer default 0,
  analyzed_at timestamptz default now()
);

-- ── ROW LEVEL SECURITY ─────────────────────────────────────
alter table users enable row level security;
alter table deals enable row level security;
alter table signals enable row level security;
alter table analyses enable row level security;

-- Users can only see their own data
create policy "users_own_data" on users for all using (auth.uid() = id);
create policy "deals_own_data" on deals for all using (auth.uid() = user_id);
create policy "signals_own_data" on signals for all using (
  deal_id in (select id from deals where user_id = auth.uid())
);
create policy "analyses_own_data" on analyses for all using (
  deal_id in (select id from deals where user_id = auth.uid())
);

-- ── INDEXES ────────────────────────────────────────────────
create index idx_deals_user_id on deals(user_id);
create index idx_deals_stage on deals(stage);
create index idx_signals_deal_id on signals(deal_id);
create index idx_analyses_deal_id on analyses(deal_id);
create index idx_analyses_analyzed_at on analyses(analyzed_at desc);

-- ── SEED DATA (optional demo deals) ───────────────────────
-- Run this after creating a user to see demo data
-- insert into deals (user_id, company, contact_name, contact_email, contact_role, value, stage, days_stale, notes)
-- values
--   ('your-user-uuid', 'Northbridge Capital', 'Sarah Chen', 'sarah@northbridge.com', 'VP Operations', 124000, 'Proposal Sent', 12, 'Strong discovery call. Sent proposal May 22.'),
--   ('your-user-uuid', 'Vertex Logistics', 'James Okafor', 'james@vertexlogistics.com', 'CTO', 87500, 'Discovery', 3, 'Very technical buyer. Wants API deep-dive.'),
--   ('your-user-uuid', 'Solaris Energy', 'Priya Anand', 'priya@solarisgroup.com', 'CFO', 210000, 'Negotiation', 6, 'Pushing on price. Asked for 20% discount.');
