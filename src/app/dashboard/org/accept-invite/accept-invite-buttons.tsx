"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { acceptInvite, rejectInvite } from "../actions"

export function AcceptInviteButtons({ invitationId }: { invitationId: string }) {
    const router = useRouter()
    const [pending, setPending] = useState<"accept" | "reject" | null>(null)

    async function handle(action: "accept" | "reject") {
        setPending(action)
        try {
            if (action === "accept") {
                await acceptInvite(invitationId)
                toast.success("Welcome to the organization!")
                router.push("/dashboard")
            } else {
                await rejectInvite(invitationId)
                toast.success("Invitation declined")
                router.push("/dashboard")
            }
            router.refresh()
        } catch (e: any) {
            toast.error(e.message ?? "Something went wrong")
        } finally {
            setPending(null)
        }
    }

    return (
        <div className="flex gap-3">
            <Button
                onClick={() => handle("accept")}
                disabled={!!pending}
                className="flex-1"
            >
                {pending === "accept" ? "Joining…" : "Accept"}
            </Button>
            <Button
                variant="outline"
                onClick={() => handle("reject")}
                disabled={!!pending}
            >
                {pending === "reject" ? "Declining…" : "Decline"}
            </Button>
        </div>
    )
}
