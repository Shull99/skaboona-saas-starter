"use server"

import { randomUUID } from "crypto"
import { revalidatePath } from "next/cache"
import { eq } from "drizzle-orm"
import { requireOrg, withTenant } from "@/lib/tenant"
import * as schema from "@/database/schema"

export async function listProjects() {
    const { orgId } = await requireOrg()
    return withTenant(orgId, (tx) =>
        tx.query.projects.findMany({
            where: eq(schema.projects.organizationId, orgId),
            orderBy: (p, { desc }) => [desc(p.createdAt)]
        })
    )
}

export async function createProject(name: string) {
    const trimmed = name.trim()
    if (!trimmed) throw new Error("Project name is required")

    const { orgId } = await requireOrg()

    await withTenant(orgId, (tx) =>
        tx.insert(schema.projects).values({
            id: randomUUID(),
            organizationId: orgId,
            name: trimmed
        })
    )

    revalidatePath("/dashboard/projects")
}

export async function deleteProject(projectId: string) {
    const { orgId } = await requireOrg()

    await withTenant(orgId, (tx) =>
        tx
            .delete(schema.projects)
            .where(eq(schema.projects.id, projectId))
        // RLS ensures this only deletes the org's own rows
    )

    revalidatePath("/dashboard/projects")
}
