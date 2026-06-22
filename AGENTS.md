# Tenancy Model

This app is a multi-tenant SaaS. Each tenant is an **organization**. This document defines the non-negotiable rules that every contributor and AI agent must follow.

## The one rule

> **Every tenant table gets `organization_id` + RLS + goes through the scoped helper.**

No exceptions. A table that holds tenant data without all three of these is a data-leak waiting to happen.

## Structure

```
User ──── members ──── Organization
                           │
                    ┌──────┴──────┐
               invitations    projects   (and future tenant tables)
```

- **Organizations** own all tenant data.
- **Members** join organizations with roles: `owner`, `admin`, `member`.
- The active organization for a session is stored as `activeOrganizationId` on the `sessions` row (set by the Better Auth organization plugin).

## The three layers of tenant isolation

### 1. Session + active org

Every authenticated server request starts with `requireOrg()` (`src/lib/tenant.ts`):

```ts
const { orgId, userId, role } = await requireOrg()
```

This:
- Verifies the session is authenticated.
- Reads `session.activeOrganizationId`.
- Confirms the user is a member of that org.
- Returns `{ orgId, userId, role }` — the only trusted org context in the request.

### 2. App-layer scoping with `withTenant`

All queries against tenant tables must go through `withTenant`:

```ts
await withTenant(orgId, (tx) =>
    tx.insert(schema.projects).values({ organizationId: orgId, ... })
)
```

`withTenant` wraps the query in a Postgres transaction and runs:

```sql
SELECT set_config('app.org_id', $orgId, true)
```

The `true` flag makes it `SET LOCAL` — the GUC is scoped to the transaction and cleared on commit or rollback.

### 3. Postgres Row-Level Security (RLS)

Every tenant table has:

```sql
ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;
ALTER TABLE <table> FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON <table>
    USING (organization_id = nullif(current_setting('app.org_id', true), ''))
    WITH CHECK (organization_id = nullif(current_setting('app.org_id', true), ''));
```

`FORCE ROW LEVEL SECURITY` ensures the policy applies even to the Postgres superuser (the app's DB user). `nullif(..., '')` prevents the empty-string GUC from accidentally matching.

If a query reaches the DB without a GUC set (e.g., a bug bypasses `withTenant`), RLS returns zero rows for reads and blocks writes. This is the backstop.

## Adding a new tenant table

1. Add `organization_id text not null references organizations(id) on delete cascade` to the schema.
2. Add the table to the SQL migration with the three RLS statements above.
3. All server actions touching that table call `requireOrg()` then `withTenant(orgId, ...)`.
4. Write a minimum isolation test (see `src/tests/tenant-isolation.test.ts` for the pattern).

## Billing

Billing is org-scoped (B2B). Stripe customers are organizations, not users.

- `organizations.stripeCustomerId` holds the Stripe customer ID.
- Created in `organizationCreation.afterCreate` hook (`src/lib/auth.ts`).
- `authorizeReference` in the Stripe plugin confirms the caller is an `admin` or `owner` of the referenced org before checkout.
- `referenceId` on subscriptions is the `organizationId`.

Do not add `stripeCustomerId` to individual users for new features.

## Roles

| Role | Can do |
|------|--------|
| `owner` | Everything including delete org |
| `admin` | Invite/remove members, manage billing |
| `member` | Read/write tenant resources |

Check roles with `requireAdmin(ctx)` for privileged actions:

```ts
const ctx = await requireOrg()
requireAdmin(ctx) // throws FORBIDDEN if not owner/admin
```

## Invitation flow

1. Admin calls the `inviteMember` server action → row inserted in `invitations` (status `pending`) + email sent via Resend.
2. Invitee clicks link → `/dashboard/org/accept-invite?id=<invitationId>`.
3. Invitee accepts → status set to `accepted`, member row inserted.
4. Invitee rejects → status set to `rejected`, no member row.

## Active org gate

The dashboard layout (`src/app/dashboard/layout.tsx`) wraps all content in `<OrgGate>` (`src/components/layout/org-gate.tsx`), which:

- Auto-activates if the user has exactly one org.
- Shows an org picker if the user has multiple orgs.
- Redirects to `/dashboard/org/create` if the user has no orgs.

`requireOrg()` can therefore assume an active org always exists when called from inside the dashboard.

## Tests

```
npx tsx src/tests/tenant-isolation.test.ts   # RLS + app-layer isolation
npx tsx src/tests/invite-flow.test.ts        # invite → accept → member
```

Requires `DATABASE_URL` set and the migration applied.
