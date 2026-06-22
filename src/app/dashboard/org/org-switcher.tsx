"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { switchOrganization } from "./actions"

interface Org {
    id: string
    name: string
}

export function OrgSwitcher({ orgs, activeOrgId }: { orgs: Org[]; activeOrgId: string }) {
    const router = useRouter()
    const [pending, setPending] = useState<string | null>(null)

    async function handle(orgId: string) {
        if (orgId === activeOrgId) return
        setPending(orgId)
        try {
            await switchOrganization(orgId)
            router.refresh()
        } catch {
            toast.error("Failed to switch organization")
        } finally {
            setPending(null)
        }
    }

    return (
        <div className="flex flex-wrap gap-2">
            {orgs.map((org) => (
                <Button
                    key={org.id}
                    variant={org.id === activeOrgId ? "default" : "outline"}
                    size="sm"
                    onClick={() => handle(org.id)}
                    disabled={pending === org.id}
                >
                    {org.name}
                </Button>
            ))}
        </div>
    )
}
