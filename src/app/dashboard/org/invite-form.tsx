"use client"

import { useState } from "react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select"
import { inviteMember } from "./actions"

export function InviteForm() {
    const router = useRouter()
    const [email, setEmail] = useState("")
    const [role, setRole] = useState<"admin" | "member">("member")
    const [pending, setPending] = useState(false)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!email.trim()) return

        setPending(true)
        try {
            await inviteMember(email.trim(), role)
            toast.success(`Invitation sent to ${email}`)
            setEmail("")
            router.refresh()
        } catch (err: any) {
            toast.error(err.message ?? "Failed to send invitation")
        } finally {
            setPending(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="flex items-end gap-3">
            <div className="flex-1 space-y-1.5">
                <Label htmlFor="invite-email">Email address</Label>
                <Input
                    id="invite-email"
                    type="email"
                    placeholder="colleague@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />
            </div>
            <div className="w-32 space-y-1.5">
                <Label htmlFor="invite-role">Role</Label>
                <Select value={role} onValueChange={(v) => setRole(v as "admin" | "member")}>
                    <SelectTrigger id="invite-role">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="member">Member</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <Button type="submit" disabled={pending}>
                {pending ? "Sending…" : "Send invite"}
            </Button>
        </form>
    )
}
