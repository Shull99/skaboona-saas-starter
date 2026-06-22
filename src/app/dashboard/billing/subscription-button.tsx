"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import type { Plan } from "@/lib/payments/plans"
import { authClient } from "@/lib/auth-client"
import { updateExistingSubscription } from "@/lib/payments/actions"

interface SubscriptionButtonProps {
    buttonText: string
    plan: Plan
    activeSub?: any
    subId?: string
    orgId: string
}

export default function SubscriptionButton({
    buttonText,
    plan,
    activeSub,
    subId,
    orgId
}: SubscriptionButtonProps) {
    const router = useRouter()
    const [isPending, setIsPending] = useState(false)

    const handleSubscription = async () => {
        try {
            setIsPending(true)

            if (activeSub && subId) {
                const loadingToast = toast.loading("Updating subscription…")
                const result = await updateExistingSubscription(subId, plan.priceId)
                toast.dismiss(loadingToast)

                if (result.status) {
                    toast.success(result.message || "Subscription updated successfully")
                    setTimeout(() => router.refresh(), 3000)
                } else {
                    toast.error(result.message || "Failed to update subscription")
                }
            } else {
                // referenceId = orgId so Stripe subscription is charged to the org
                const { error } = await authClient.subscription.upgrade({
                    plan: plan.name,
                    referenceId: orgId,
                    successUrl: "/dashboard/billing",
                    cancelUrl: "/dashboard/billing"
                })

                if (error) {
                    console.error(error)
                    toast.error("Failed to start subscription")
                }
            }
        } catch {
            toast.error("An unexpected error occurred")
        } finally {
            setIsPending(false)
        }
    }

    return (
        <Button onClick={handleSubscription} disabled={isPending}>
            {isPending ? "Processing…" : buttonText}
        </Button>
    )
}
