import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from "@/components/ui/card"
import { AcceptInviteButtons } from "./accept-invite-buttons"

export const metadata = { title: "Accept Invitation" }

export default async function AcceptInvitePage({
    searchParams
}: {
    searchParams: Promise<{ id?: string }>
}) {
    const { id: invitationId } = await searchParams
    if (!invitationId) redirect("/dashboard")

    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) redirect(`/auth/sign-in?redirectTo=/dashboard/org/accept-invite?id=${invitationId}`)

    let invitation: any = null
    try {
        invitation = await auth.api.getInvitation({
            query: { id: invitationId },
            headers: await headers()
        })
    } catch {
        // Invitation may not exist or may be expired
    }

    if (!invitation || invitation.status !== "pending") {
        return (
            <main className="container mx-auto flex grow flex-col items-center justify-center py-18">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle>Invitation unavailable</CardTitle>
                        <CardDescription>
                            This invitation has expired, been accepted, or does not exist.
                        </CardDescription>
                    </CardHeader>
                </Card>
            </main>
        )
    }

    return (
        <main className="container mx-auto flex grow flex-col items-center justify-center py-18">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>You've been invited</CardTitle>
                    <CardDescription>
                        You've been invited to join{" "}
                        <span className="font-semibold text-foreground">
                            {invitation.organizationId}
                        </span>{" "}
                        as <span className="capitalize">{invitation.role}</span>.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <AcceptInviteButtons invitationId={invitationId} />
                </CardContent>
            </Card>
        </main>
    )
}
