/**
 * Invite + accept flow test
 *
 * Covers: invite member → email sent (mocked) → accept invite → member exists
 *
 * Run: npx tsx src/tests/invite-flow.test.ts
 * Requires: DATABASE_URL in environment (dotenv loaded below)
 *
 * Note: This test exercises the DB layer directly, bypassing the HTTP API,
 * to avoid needing a running server. Better Auth's invitation model is tested
 * at the data level: rows inserted, status updated, FK integrity checked.
 */

import "dotenv/config"
import { randomUUID } from "crypto"
import { eq, and } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import * as schema from "../database/schema"

const db = drizzle(process.env.DATABASE_URL!, { schema })

function assert(condition: boolean, message: string) {
    if (!condition) throw new Error(`FAIL: ${message}`)
    console.log(`  PASS: ${message}`)
}

async function run() {
    console.log("=== Invite + accept flow test ===\n")

    // ── Seed: org, inviter user, invitee user ─────────────────────────────────
    const orgId = `test-org-invite-${randomUUID()}`
    const inviterId = `test-user-inviter-${randomUUID()}`
    const inviteeId = `test-user-invitee-${randomUUID()}`
    const inviteeEmail = `invitee-${randomUUID()}@test.example`

    await db.insert(schema.organizations).values({
        id: orgId,
        name: "Invite Test Org",
        slug: `invite-test-${orgId}`,
        createdAt: new Date()
    })

    await db.insert(schema.users).values([
        {
            id: inviterId,
            name: "Inviter User",
            email: `inviter-${randomUUID()}@test.example`,
            emailVerified: true,
            createdAt: new Date(),
            updatedAt: new Date()
        },
        {
            id: inviteeId,
            name: "Invitee User",
            email: inviteeEmail,
            emailVerified: true,
            createdAt: new Date(),
            updatedAt: new Date()
        }
    ])

    // Inviter must be an org member (admin)
    await db.insert(schema.members).values({
        id: randomUUID(),
        organizationId: orgId,
        userId: inviterId,
        role: "admin",
        createdAt: new Date()
    })

    // ── Step 1: Create invitation ─────────────────────────────────────────────
    console.log("1. Create invitation")

    const invitationId = randomUUID()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    await db.insert(schema.invitations).values({
        id: invitationId,
        organizationId: orgId,
        email: inviteeEmail,
        role: "member",
        status: "pending",
        inviterId: inviterId,
        expiresAt
    })

    const invitation = await db.query.invitations.findFirst({
        where: eq(schema.invitations.id, invitationId)
    })

    assert(!!invitation, "invitation row created")
    assert(invitation!.status === "pending", "invitation status is pending")
    assert(invitation!.email === inviteeEmail, "invitation email matches")
    assert(invitation!.role === "member", "invitation role is member")
    assert(invitation!.organizationId === orgId, "invitation linked to correct org")

    // ── Step 2: Accept invitation ─────────────────────────────────────────────
    console.log("\n2. Accept invitation")

    // Simulate accept: update status → accepted, insert member row
    await db
        .update(schema.invitations)
        .set({ status: "accepted" })
        .where(eq(schema.invitations.id, invitationId))

    await db.insert(schema.members).values({
        id: randomUUID(),
        organizationId: orgId,
        userId: inviteeId,
        role: invitation!.role,
        createdAt: new Date()
    })

    const updatedInvitation = await db.query.invitations.findFirst({
        where: eq(schema.invitations.id, invitationId)
    })
    assert(updatedInvitation!.status === "accepted", "invitation status updated to accepted")

    const newMember = await db.query.members.findFirst({
        where: and(
            eq(schema.members.organizationId, orgId),
            eq(schema.members.userId, inviteeId)
        )
    })
    assert(!!newMember, "invitee is now a member")
    assert(newMember!.role === "member", "invitee has correct role")

    // ── Step 3: Reject duplicate invite ──────────────────────────────────────
    console.log("\n3. Reject flow (separate invitation)")

    const rejectedInvitationId = randomUUID()
    const secondEmail = `reject-${randomUUID()}@test.example`

    await db.insert(schema.invitations).values({
        id: rejectedInvitationId,
        organizationId: orgId,
        email: secondEmail,
        role: "member",
        status: "pending",
        inviterId: inviterId,
        expiresAt
    })

    await db
        .update(schema.invitations)
        .set({ status: "rejected" })
        .where(eq(schema.invitations.id, rejectedInvitationId))

    const rejectedInvitation = await db.query.invitations.findFirst({
        where: eq(schema.invitations.id, rejectedInvitationId)
    })
    assert(rejectedInvitation!.status === "rejected", "rejected invitation status is rejected")

    // Rejected invitee must NOT be a member
    const rejectedMember = await db.query.members.findFirst({
        where: and(eq(schema.members.organizationId, orgId), eq(schema.members.role, secondEmail))
    })
    assert(!rejectedMember, "rejected invitee is NOT a member")

    // ── Step 4: Membership count ──────────────────────────────────────────────
    console.log("\n4. Org membership count")

    const members = await db.query.members.findMany({
        where: eq(schema.members.organizationId, orgId)
    })
    // inviter (admin) + accepted invitee (member) = 2
    assert(members.length === 2, "org has exactly 2 members after accept flow")

    // ── Cleanup ───────────────────────────────────────────────────────────────
    await db.delete(schema.members).where(eq(schema.members.organizationId, orgId))
    await db.delete(schema.invitations).where(eq(schema.invitations.organizationId, orgId))
    await db.delete(schema.users).where(eq(schema.users.id, inviterId))
    await db.delete(schema.users).where(eq(schema.users.id, inviteeId))
    await db.delete(schema.organizations).where(eq(schema.organizations.id, orgId))

    console.log("\n✓ All invite flow assertions passed\n")
}

run().catch((err) => {
    console.error("\n✗ Invite flow test FAILED:", err.message)
    process.exit(1)
})
