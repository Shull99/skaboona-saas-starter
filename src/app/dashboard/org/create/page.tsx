"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from "@/components/ui/card"
import { createOrganization } from "../actions"

export default function CreateOrgPage() {
    const router = useRouter()
    const [name, setName] = useState("")
    const [pending, setPending] = useState(false)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!name.trim()) return
        setPending(true)
        try {
            await createOrganization(name.trim())
            toast.success("Organization created")
            router.push("/dashboard")
            router.refresh()
        } catch (err: any) {
            toast.error(err.message ?? "Failed to create organization")
        } finally {
            setPending(false)
        }
    }

    return (
        <main className="container mx-auto flex grow flex-col items-center justify-center gap-4 self-center py-18">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>Create your organization</CardTitle>
                    <CardDescription>
                        All your work lives inside an organization. You can invite teammates later.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="org-name">Organization name</Label>
                            <Input
                                id="org-name"
                                placeholder="Acme Corp"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                                autoFocus
                            />
                        </div>
                        <Button type="submit" className="w-full" disabled={pending || !name.trim()}>
                            {pending ? "Creating…" : "Create organization"}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </main>
    )
}
