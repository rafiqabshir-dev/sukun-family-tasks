-- Barakah Kids Race Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Families table
CREATE TABLE families (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  invite_code TEXT UNIQUE NOT NULL DEFAULT substring(md5(random()::text), 1, 8),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Profiles table (linked to Supabase Auth users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  family_id UUID REFERENCES families(id) ON DELETE SET NULL,
  role TEXT NOT NULL CHECK (role IN ('guardian', 'kid')),
  display_name TEXT NOT NULL,
  age INTEGER,
  powers TEXT[] DEFAULT '{}',
  requires_login BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks (templates) table
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  icon_key TEXT DEFAULT 'checkbox',
  default_stars INTEGER DEFAULT 1,
  difficulty TEXT DEFAULT 'easy',
  preferred_powers TEXT[] DEFAULT '{}',
  min_age INTEGER,
  max_age INTEGER,
  is_archived BOOLEAN DEFAULT false,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Task instances (assigned tasks)
CREATE TABLE task_instances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  assignee_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_by_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'pending_approval', 'approved', 'rejected')),
  due_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  completion_requested_by UUID REFERENCES profiles(id),
  completion_requested_at TIMESTAMPTZ
);

-- Task approvals table
CREATE TABLE task_approvals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_instance_id UUID NOT NULL REFERENCES task_instances(id) ON DELETE CASCADE,
  approver_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected')),
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stars ledger for tracking all star changes
CREATE TABLE stars_ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  task_instance_id UUID REFERENCES task_instances(id),
  created_by_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rewards table
CREATE TABLE rewards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  star_cost INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reward claims table
CREATE TABLE reward_claims (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reward_id UUID NOT NULL REFERENCES rewards(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  granted_by_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  star_cost INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Spin queue table
CREATE TABLE spin_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  custom_title TEXT,
  custom_stars INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Spin history for fairness tracking
CREATE TABLE spin_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  winner_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  task_instance_id UUID REFERENCES task_instances(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Join requests table for family join approval workflow
CREATE TABLE join_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  requester_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by_profile_id UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(family_id, requester_profile_id)
);

-- Create indexes for performance
CREATE INDEX idx_profiles_family ON profiles(family_id);
CREATE INDEX idx_tasks_family ON tasks(family_id);
CREATE INDEX idx_task_instances_family ON task_instances(family_id);
CREATE INDEX idx_task_instances_assignee ON task_instances(assignee_profile_id);
CREATE INDEX idx_task_instances_status ON task_instances(status);
CREATE INDEX idx_stars_ledger_profile ON stars_ledger(profile_id);
CREATE INDEX idx_rewards_family ON rewards(family_id);
CREATE INDEX idx_spin_queue_family ON spin_queue(family_id);

-- Unique constraint to prevent duplicate approvals per task instance
CREATE UNIQUE INDEX idx_unique_task_approval ON task_approvals(task_instance_id, decision) 
  WHERE decision = 'approved';

-- Unique constraint to prevent duplicate star awards per task instance
CREATE UNIQUE INDEX idx_unique_stars_per_task ON stars_ledger(task_instance_id, profile_id) 
  WHERE task_instance_id IS NOT NULL AND delta > 0;

-- Row Level Security Policies

-- Helper function to get current user's family_id without RLS recursion
CREATE OR REPLACE FUNCTION get_my_family_id()
RETURNS UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT family_id FROM profiles WHERE id = auth.uid()
$$;

-- Enable RLS on all tables
ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE stars_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE spin_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE spin_history ENABLE ROW LEVEL SECURITY;

-- Families: Users can see their family or any family (for joining)
CREATE POLICY "Users can view families"
  ON families FOR SELECT
  USING (true);

CREATE POLICY "Users can create families"
  ON families FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update their family"
  ON families FOR UPDATE
  USING (id = get_my_family_id());

-- Profiles: Two separate policies to avoid recursion
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Users can view family members"
  ON profiles FOR SELECT
  USING (
    family_id IS NOT NULL AND 
    family_id = get_my_family_id()
  );

CREATE POLICY "Users can create profile"
  ON profiles FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

-- Tasks: Family members can view, guardians can modify
CREATE POLICY "Family members can view tasks"
  ON tasks FOR SELECT
  USING (family_id = get_my_family_id());

CREATE POLICY "Guardians can create tasks"
  ON tasks FOR INSERT
  WITH CHECK (
    family_id = get_my_family_id() AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'guardian')
  );

CREATE POLICY "Guardians can update tasks"
  ON tasks FOR UPDATE
  USING (
    family_id = get_my_family_id() AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'guardian')
  );

-- Task Instances: Family members can view, specific update rules
CREATE POLICY "Family members can view task instances"
  ON task_instances FOR SELECT
  USING (family_id = get_my_family_id());

CREATE POLICY "Guardians can create task instances"
  ON task_instances FOR INSERT
  WITH CHECK (
    family_id = get_my_family_id() AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'guardian')
  );

CREATE POLICY "Kids can mark their own tasks pending"
  ON task_instances FOR UPDATE
  USING (
    assignee_profile_id = auth.uid() AND status = 'open'
  );

CREATE POLICY "Guardians can update task instances"
  ON task_instances FOR UPDATE
  USING (
    family_id = get_my_family_id() AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'guardian')
  );

-- Task Approvals: Family members can view, guardians can create
CREATE POLICY "Family members can view approvals"
  ON task_approvals FOR SELECT
  USING (
    task_instance_id IN (
      SELECT id FROM task_instances 
      WHERE family_id = get_my_family_id()
    )
  );

CREATE POLICY "Guardians can create approvals"
  ON task_approvals FOR INSERT
  WITH CHECK (
    approver_profile_id = auth.uid() AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'guardian') AND
    task_instance_id IN (
      SELECT id FROM task_instances 
      WHERE completion_requested_by != auth.uid()
    )
  );

-- Stars Ledger: Family members can view, guardians can modify
CREATE POLICY "Family members can view stars ledger"
  ON stars_ledger FOR SELECT
  USING (family_id = get_my_family_id());

CREATE POLICY "Guardians can add to stars ledger"
  ON stars_ledger FOR INSERT
  WITH CHECK (
    family_id = get_my_family_id() AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'guardian')
  );

-- Rewards: Family members can view, guardians can modify
CREATE POLICY "Family members can view rewards"
  ON rewards FOR SELECT
  USING (family_id = get_my_family_id());

CREATE POLICY "Guardians can create rewards"
  ON rewards FOR INSERT
  WITH CHECK (
    family_id = get_my_family_id() AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'guardian')
  );

CREATE POLICY "Guardians can update rewards"
  ON rewards FOR UPDATE
  USING (
    family_id = get_my_family_id() AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'guardian')
  );

-- Reward Claims: Family members can view
CREATE POLICY "Family members can view reward claims"
  ON reward_claims FOR SELECT
  USING (
    reward_id IN (
      SELECT id FROM rewards 
      WHERE family_id = get_my_family_id()
    )
  );

CREATE POLICY "Guardians can create reward claims"
  ON reward_claims FOR INSERT
  WITH CHECK (
    granted_by_profile_id = auth.uid() AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'guardian')
  );

-- Spin Queue: Family members can view, guardians can modify
CREATE POLICY "Family members can view spin queue"
  ON spin_queue FOR SELECT
  USING (family_id = get_my_family_id());

CREATE POLICY "Guardians can modify spin queue"
  ON spin_queue FOR ALL
  USING (
    family_id = get_my_family_id() AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'guardian')
  );

-- Spin History: Family members can view
CREATE POLICY "Family members can view spin history"
  ON spin_history FOR SELECT
  USING (family_id = get_my_family_id());

CREATE POLICY "Guardians can add spin history"
  ON spin_history FOR INSERT
  WITH CHECK (
    family_id = get_my_family_id() AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'guardian')
  );

-- Join Requests: Users can see their own requests, owners can see all for their family
ALTER TABLE join_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own join requests"
  ON join_requests FOR SELECT
  USING (requester_profile_id = auth.uid());

CREATE POLICY "Family owners can view family join requests"
  ON join_requests FOR SELECT
  USING (family_id = get_my_family_id());

CREATE POLICY "Users can create join requests"
  ON join_requests FOR INSERT
  WITH CHECK (requester_profile_id = auth.uid());

CREATE POLICY "Family owners can update join requests"
  ON join_requests FOR UPDATE
  USING (
    family_id = get_my_family_id() AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'guardian')
  );

CREATE INDEX idx_join_requests_family ON join_requests(family_id);
CREATE INDEX idx_join_requests_requester ON join_requests(requester_profile_id);
CREATE INDEX idx_join_requests_status ON join_requests(status);

-- Function to get total stars for a profile
CREATE OR REPLACE FUNCTION get_profile_stars(profile_uuid UUID)
RETURNS INTEGER AS $$
  SELECT COALESCE(SUM(delta), 0)::INTEGER
  FROM stars_ledger
  WHERE profile_id = profile_uuid;
$$ LANGUAGE SQL STABLE;

-- Function to join family by invite code
CREATE OR REPLACE FUNCTION join_family_by_code(invite_code_param TEXT)
RETURNS UUID AS $$
DECLARE
  family_uuid UUID;
BEGIN
  SELECT id INTO family_uuid
  FROM families
  WHERE invite_code = invite_code_param;
  
  IF family_uuid IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;
  
  RETURN family_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
