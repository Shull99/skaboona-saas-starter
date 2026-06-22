import { headers } from "next/headers"
import { eq, and, inArray, sql } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { db } from "@/database/db"
import * as schema from "@/database/schema"

export type OrgContext = {
    orgId: string
    userId: string
    role: string
}

/**
 * Reads the active org from the session. Throws if:
 * - user is not authenticated
 * - no active organization is set on the session
 * - user is not a member of that organization
 */
export async function requireOrg(): Promise<OrgContext> {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) {
        throw new Error("UNAUTHORIZED: authentication required")
    }

    const orgId = (session.session as any).activeOrganizationId as string | undefined
    if (!orgId) {
        throw new Error("NO_ACTIVE_ORG: set an active organization first")
    }

    const member = await db.query.members.findFirst({
        where: and(
            eq(schema.members.organizationId, orgId),
            eq(schema.members.userId, session.user.id)
        )
    })

    if (!member) {
        throw new Error(`NOT_MEMBER: user ${session.user.id} is not a member of org ${orgId}`)
    }

    return { orgId, userId: session.user.id, role: member.role }
}

/**
 * Runs `fn` inside a transaction with the org GUC set for the duration.
 * All queries inside `fn` are covered by the RLS policy on tenant tables.
 *
 *   const rows = await withTenant(orgId, tx => tx.query.projects.findMany())
 */
export async function withTenant<T>(
    orgId: string,
    fn: (tx: typeof db) => Promise<T>
): Promise<T> {
    return db.transaction(async (tx) => {
        // SET LOCAL is transaction-scoped; the RLS policy reads this GUC
        await tx.execute(sql`SELECT set_config('app.org_id', ${orgId}, true)`)
        return fn(tx as typeof db)
    })
}

export function requireAdmin(ctx: OrgContext): void {
    if (!["owner", "admin"].includes(ctx.role)) {
        throw new Error("FORBIDDEN: admin or owner role required")
    }
}
