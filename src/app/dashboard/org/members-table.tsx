"use client"

import { useState } from "react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select"
import { removeMember, updateMemberRole, leaveOrganization } from "./actions"

interface Member {
    id: string
    userId: string
    role: string
    user: { name: string; email: string }
}

interface Props {
    members: Member[]
    currentUserId: string
    currentRole: string
    orgId: string
}

export function OrgMembersTable({ members, currentUserId, currentRole, orgId }: Props) {
    const router = useRouter()
    const isAdmin = currentRole === "owner" || currentRole === "admin"
    const [pending, setPending] = useState<string | null>(null)

    async function handleRoleChange(memberId: string, role: "admin" | "member") {
        setPending(memberId)
        try {
            await updateMemberRole(memberId, role)
            toast.success("Role updated")
            router.refresh()
        } catch (e: any) {
            toast.error(e.message ?? "Failed to update role")
        } finally {
            setPending(null)
        }
    }

    async function handleRemove(memberId: string) {
        setPending(memberId)
        try {
            await removeMember(memberId)
            toast.success("Member removed")
            router.refresh()
        } catch (e: any) {
            toast.error(e.message ?? "Failed to remove member")
        } finally {
            setPending(null)
        }
    }

    async function handleLeave() {
        setPending("leave")
        try {
            await leaveOrganization()
            toast.success("Left organization")
            router.refresh()
        } catch (e: any) {
            toast.error(e.message ?? "Failed to leave")
        } finally {
            setPending(null)
        }
    }

    return (
        <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
                <thead className="border-b bg-muted/40">
                    <tr>
                        <th className="px-4 py-3 text-left font-medium">Member</th>
                        <th className="px-4 py-3 text-left font-medium">Role</th>
                        {isAdmin && <th className="px-4 py-3 text-right font-medium">Actions</th>}
                    </tr>
                </thead>
                <tbody>
                    {members.map((m) => {
                        const isSelf = m.userId === currentUserId
                        return (
                            <tr key={m.id} className="border-b last:border-0">
                                <td className="px-4 py-3">
                                    <div className="font-medium">{m.user.name}</div>
                                    <div className="text-muted-foreground text-xs">{m.user.email}</div>
                                </td>
                                <td className="px-4 py-3">
                                    {isAdmin && !isSelf && m.role !== "owner" ? (
                                        <Select
                                            defaultValue={m.role}
                                            onValueChange={(v) => handleRoleChange(m.id, v as "admin" | "member")}
                                            disabled={pending === m.id}
                                        >
                                            <SelectTrigger className="h-7 w-28">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="admin">Admin</SelectItem>
                                                <SelectItem value="member">Member</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    ) : (
                                        <Badge variant="secondary" className="capitalize">
                                            {m.role}
                                        </Badge>
                                    )}
                                </td>
                                {isAdmin && (
                                    <td className="px-4 py-3 text-right">
                                        {isSelf ? (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={handleLeave}
                                                disabled={pending === "leave"}
                                            >
                                                Leave
                                            </Button>
                                        ) : (
                                            m.role !== "owner" && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleRemove(m.id)}
                                                    disabled={pending === m.id}
                                                    className="text-destructive hover:text-destructive"
                                                >
                                                    Remove
                                                </Button>
                                            )
                                        )}
                                    </td>
                                )}
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}
