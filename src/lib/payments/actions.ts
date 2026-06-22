"use server"

import { auth } from "@/lib/auth"
import type { Subscription } from "@better-auth/stripe"
import { headers } from "next/headers"
import Stripe from "stripe"
import { env } from "@/env"

const stripeClient = new Stripe(env.STRIPE_SECRET_KEY)

export async function getActiveSubscription(): Promise<{
    status: boolean
    message?: string
    subscription: Subscription | null
}> {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) {
        return { status: false, message: "You need to be logged in.", subscription: null }
    }

    const orgId = (session.session as any).activeOrganizationId as string | undefined

    try {
        const activeSubs = await auth.api.listActiveSubscriptions({
            headers: await headers(),
            // Query by org ID so billing is org-scoped
            ...(orgId ? { query: { referenceId: orgId } } : {})
        })
        const activeSub =
            activeSubs.length > 1
                ? activeSubs.find((sub) => sub.status === "active" || sub.status === "trialing")
                : activeSubs[0]
        return { subscription: activeSub ?? null, status: true }
    } catch (error) {
        console.error("[getActiveSubscription]", error)
        return { status: false, message: "Something went wrong.", subscription: null }
    }
}

export async function updateExistingSubscription(
    subId: string,
    switchToPriceId: string
): Promise<{ status: boolean; message: string }> {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) {
        return { status: false, message: "You need to be logged in." }
    }

    if (!subId || !switchToPriceId) {
        return { status: false, message: "Invalid parameters." }
    }

    try {
        const subscription = await stripeClient.subscriptions.retrieve(subId)
        if (!subscription.items.data.length) {
            return { status: false, message: "Invalid subscription. No subscription items found!" }
        }

        await stripeClient.subscriptions.update(subId, {
            items: [{ id: subscription.items.data[0].id, price: switchToPriceId }],
            cancel_at_period_end: false,
            proration_behavior: "create_prorations"
        })

        return { status: true, message: "Subscription updated successfully!" }
    } catch (error) {
        console.error("[updateExistingSubscription]", error)
        return { status: false, message: "Something went wrong while updating the subscription." }
    }
}
