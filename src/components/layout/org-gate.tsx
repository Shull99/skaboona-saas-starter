"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import type { ReactNode } from "react"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

type GateState = "checking" | "active" | "pick" | "create"

export function OrgGate({ children }: { children: ReactNode }) {
    const { data: session, isPending } = authClient.useSession()
    const router = useRouter()
    const [gateState, setGateState] = useState<GateState>("checking")
    const [orgs, setOrgs] = useState<Array<{ id: string; name: string; slug: string }>>([])

    const activeOrgId = session?.session?.activeOrganizationId

    useEffect(() => {
        if (isPending || !session?.user) return

        if (activeOrgId) {
            setGateState("active")
            return
        }

        authClient.organization.listOrganizations().then(({ data: orgList }) => {
            if (!orgList || orgList.length === 0) {
                setGateState("create")
                return
            }
            if (orgList.length === 1) {
                // Auto-activate the only org without prompting
                authClient.organization.setActive({ organizationId: orgList[0].id }).then(() => {
                    router.refresh()
                })
                return
            }
            // Multiple orgs: let the user pick
            setOrgs(orgList)
            setGateState("pick")
        })
    }, [session, isPending, activeOrgId, router])

    if (isPending || gateState === "checking") {
        return <OrgGateSkeleton />
    }

    if (gateState === "active") {
        return <>{children}</>
    }

    if (gateState === "pick") {
        return (
            <div className="flex min-h-screen items-center justify-center p-6">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle>Select organization</CardTitle>
                        <CardDescription>Choose which organization to work in</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2">
                        {orgs.map((org) => (
                            <Button
                                key={org.id}
                                variant="outline"
                                className="justify-start"
                                onClick={async () => {
                                    await authClient.organization.setActive({ organizationId: org.id })
                                    router.refresh()
                                }}
                            >
                                {org.name}
                            </Button>
                        ))}
                    </CardContent>
                </Card>
            </div>
        )
    }

    // gateState === "create"
    return (
        <div className="flex min-h-screen items-center justify-center p-6">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>Create your organization</CardTitle>
                    <CardDescription>
                        You need an organization to use the dashboard. Have an invite? Open the link in your email.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button onClick={() => router.push("/dashboard/org/create")}>
                        Create organization
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}

function OrgGateSkeleton() {
    return (
        <div className="flex min-h-screen items-center justify-center p-6">
            <div className="w-full max-w-md space-y-3">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-64" />
                <Skeleton className="h-10 w-full" />
            </div>
        </div>
    )
}
