"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import Stripe from "stripe"
import { auth } from "@/lib/auth"
import { requireOrg, requireAdmin } from "@/lib/tenant"
import { env } from "@/env"

const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-06-30.basil",
    typescript: true
})

export async function createOrganization(name: string) {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) throw new Error("UNAUTHORIZED")

    const slug = name
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "")

    const org = await auth.api.createOrganization({
        body: { name, slug },
        headers: await headers()
    })

    // Set it as active immediately
    await auth.api.setActiveOrganization({
        body: { organizationId: (org as any).id },
        headers: await headers()
    })

    revalidatePath("/dashboard")
    return org
}

export async function switchOrganization(organizationId: string) {
    await auth.api.setActiveOrganization({
        body: { organizationId },
        headers: await headers()
    })
    revalidatePath("/dashboard")
}

export async function inviteMember(email: string, role: "admin" | "member") {
    const ctx = await requireOrg()
    requireAdmin(ctx)

    await auth.api.inviteMember({
        body: { organizationId: ctx.orgId, email, role },
        headers: await headers()
    })
    revalidatePath("/dashboard/org")
}

export async function removeMember(memberId: string) {
    const ctx = await requireOrg()
    requireAdmin(ctx)

    await auth.api.removeMember({
        body: { organizationId: ctx.orgId, memberIdOrEmail: memberId },
        headers: await headers()
    })
    revalidatePath("/dashboard/org")
}

export async function updateMemberRole(memberId: string, role: "admin" | "member") {
    const ctx = await requireOrg()
    requireAdmin(ctx)

    await auth.api.updateMemberRole({
        body: { organizationId: ctx.orgId, memberId, role },
        headers: await headers()
    })
    revalidatePath("/dashboard/org")
}

export async function acceptInvite(invitationId: string) {
    await auth.api.acceptInvitation({
        body: { invitationId },
        headers: await headers()
    })
    revalidatePath("/dashboard")
}

export async function rejectInvite(invitationId: string) {
    await auth.api.rejectInvitation({
        body: { invitationId },
        headers: await headers()
    })
    revalidatePath("/dashboard")
}

export async function leaveOrganization() {
    const ctx = await requireOrg()

    // Prevent the last owner from leaving
    const org = await auth.api.getFullOrganization({
        query: { organizationId: ctx.orgId },
        headers: await headers()
    })
    if (!org) throw new Error("Organization not found")

    const owners = (org as any).members?.filter((m: any) => m.role === "owner") ?? []
    if (owners.length === 1 && ctx.role === "owner") {
        throw new Error("LAST_OWNER: transfer ownership before leaving")
    }

    await auth.api.leaveOrganization({
        body: { organizationId: ctx.orgId },
        headers: await headers()
    })
    revalidatePath("/dashboard")
}

export async function deleteOrganization() {
    const ctx = await requireOrg()
    if (ctx.role !== "owner") throw new Error("FORBIDDEN: only the owner can delete the org")

    await auth.api.deleteOrganization({
        body: { organizationId: ctx.orgId },
        headers: await headers()
    })

    // Cancel Stripe subscription if one exists
    try {
        const activeSubs = await auth.api.listActiveSubscriptions({
            headers: await headers(),
            query: { referenceId: ctx.orgId }
        })
        for (const sub of activeSubs) {
            if (sub.stripeSubscriptionId) {
                await stripe.subscriptions.cancel(sub.stripeSubscriptionId)
            }
        }
    } catch {
        // Non-fatal: Stripe cancel failure doesn't block org deletion
    }

    revalidatePath("/dashboard")
}
