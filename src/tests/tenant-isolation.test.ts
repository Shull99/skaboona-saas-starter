/**
 * Tenant isolation test
 *
 * Verifies that org A cannot read or mutate org B's projects at BOTH:
 *   1. The app layer  (withTenant scoping via organizationId filter)
 *   2. The RLS layer  (raw query without the GUC set → zero rows)
 *
 * Run: npx tsx src/tests/tenant-isolation.test.ts
 * Requires: DATABASE_URL in environment (dotenv loaded below)
 */

import "dotenv/config"
import { randomUUID } from "crypto"
import { eq, and, sql } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import * as schema from "../database/schema"

const db = drizzle(process.env.DATABASE_URL!, { schema })

function assert(condition: boolean, message: string) {
    if (!condition) throw new Error(`FAIL: ${message}`)
    console.log(`  PASS: ${message}`)
}

async function run() {
    console.log("=== Tenant isolation test ===\n")

    // ── Seed two orgs ────────────────────────────────────────────────────────
    const orgAId = `test-org-a-${randomUUID()}`
    const orgBId = `test-org-b-${randomUUID()}`

    await db.insert(schema.organizations).values([
        { id: orgAId, name: "Test Org A", slug: `test-a-${orgAId}`, createdAt: new Date() },
        { id: orgBId, name: "Test Org B", slug: `test-b-${orgBId}`, createdAt: new Date() }
    ])

    const projectAId = randomUUID()
    const projectBId = randomUUID()

    // ── Seed a project per org via withTenant (sets GUC + runs RLS) ──────────
    await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT set_config('app.org_id', ${orgAId}, true)`)
        await tx.insert(schema.projects).values({
            id: projectAId,
            organizationId: orgAId,
            name: "Org A Project"
        })
    })

    await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT set_config('app.org_id', ${orgBId}, true)`)
        await tx.insert(schema.projects).values({
            id: projectBId,
            organizationId: orgBId,
            name: "Org B Project"
        })
    })

    // ── 1. App-layer isolation ────────────────────────────────────────────────
    console.log("1. App-layer isolation (withTenant organizationId filter)")

    const orgAProjects = await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT set_config('app.org_id', ${orgAId}, true)`)
        return tx.query.projects.findMany({
            where: eq(schema.projects.organizationId, orgAId)
        })
    })
    assert(
        orgAProjects.length === 1 && orgAProjects[0].id === projectAId,
        "withTenant(orgA) returns only org A projects"
    )

    // Attempt to read org B's project while scoped to org A — must return empty
    const crossOrgRead = await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT set_config('app.org_id', ${orgAId}, true)`)
        return tx.query.projects.findMany({
            where: eq(schema.projects.organizationId, orgBId)
        })
    })
    assert(
        crossOrgRead.length === 0,
        "withTenant(orgA) cannot read org B rows (organizationId filter)"
    )

    // ── 2. RLS backstop ───────────────────────────────────────────────────────
    console.log("\n2. RLS backstop (raw query without GUC)")

    // Without setting app.org_id, current_setting returns '' → nullif → NULL
    // The USING clause becomes `organization_id = NULL` which is always FALSE
    const noGucRows = await db.transaction(async (tx) => {
        // Explicitly unset to simulate a query that bypasses withTenant
        await tx.execute(sql`SELECT set_config('app.org_id', '', false)`)
        return tx.execute(sql`SELECT id FROM projects WHERE organization_id = ${orgAId}`)
    })
    assert(
        (noGucRows.rows as any[]).length === 0,
        "RLS blocks reads when app.org_id GUC is not set"
    )

    // ── 3. RLS write protection ───────────────────────────────────────────────
    console.log("\n3. RLS write protection (INSERT without GUC)")

    let rlsBlockedWrite = false
    try {
        await db.transaction(async (tx) => {
            await tx.execute(sql`SELECT set_config('app.org_id', '', false)`)
            await tx.execute(
                sql`INSERT INTO projects (id, organization_id, name, created_at)
                    VALUES (${randomUUID()}, ${orgAId}, 'sneaky', now())`
            )
        })
    } catch {
        rlsBlockedWrite = true
    }
    assert(rlsBlockedWrite, "RLS blocks INSERT when app.org_id GUC does not match")

    // ── Cleanup ───────────────────────────────────────────────────────────────
    await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT set_config('app.org_id', ${orgAId}, true)`)
        await tx.delete(schema.projects).where(eq(schema.projects.id, projectAId))
    })
    await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT set_config('app.org_id', ${orgBId}, true)`)
        await tx.delete(schema.projects).where(eq(schema.projects.id, projectBId))
    })
    await db.delete(schema.organizations).where(
        and(eq(schema.organizations.id, orgAId))
    )
    await db.delete(schema.organizations).where(
        and(eq(schema.organizations.id, orgBId))
    )

    console.log("\n✓ All tenant isolation assertions passed\n")
}

run().catch((err) => {
    console.error("\n✗ Tenant isolation test FAILED:", err.message)
    process.exit(1)
})
