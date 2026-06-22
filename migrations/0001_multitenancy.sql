-- Multi-tenancy migration
-- Apply with: psql $DATABASE_URL < migrations/0001_multitenancy.sql
-- Or: npx drizzle-kit migrate (if using drizzle migrations runner)

-- 1. Add activeOrganizationId to sessions
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS active_organization_id text;

-- 2. Organizations table
CREATE TABLE IF NOT EXISTS organizations (
    id              text PRIMARY KEY,
    name            text NOT NULL,
    slug            text NOT NULL UNIQUE,
    logo            text,
    metadata        text,
    created_at      timestamp NOT NULL,
    stripe_customer_id text
);

-- 3. Members table
CREATE TABLE IF NOT EXISTS members (
    id              text PRIMARY KEY,
    organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id         text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role            text NOT NULL,
    created_at      timestamp NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS members_org_user_idx ON members (organization_id, user_id);

-- 4. Invitations table
CREATE TABLE IF NOT EXISTS invitations (
    id              text PRIMARY KEY,
    organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email           text NOT NULL,
    role            text NOT NULL,
    status          text NOT NULL DEFAULT 'pending',
    inviter_id      text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at      timestamp NOT NULL
);

-- 5. Projects (reference tenant table)
CREATE TABLE IF NOT EXISTS projects (
    id              text PRIMARY KEY,
    organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            text NOT NULL,
    created_at      timestamp NOT NULL DEFAULT now()
);

-- 6. Row-Level Security on projects
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
-- FORCE applies even to the table owner so the app-level scoping and RLS are always in sync
ALTER TABLE projects FORCE ROW LEVEL SECURITY;

-- Policy: allow all DML when the GUC matches the row's org.
-- nullif prevents empty-string GUC from accidentally matching anything.
CREATE POLICY tenant_isolation ON projects
    USING (organization_id = nullif(current_setting('app.org_id', true), ''))
    WITH CHECK (organization_id = nullif(current_setting('app.org_id', true), ''));

-- Hint: to inspect projects directly in psql, run:
--   SET app.org_id = '<orgId>'; SELECT * FROM projects; RESET app.org_id;
