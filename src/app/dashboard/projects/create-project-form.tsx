"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createProject } from "./actions"

export function CreateProjectForm() {
    const router = useRouter()
    const [name, setName] = useState("")
    const [pending, setPending] = useState(false)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!name.trim()) return
        setPending(true)
        try {
            await createProject(name)
            setName("")
            toast.success("Project created")
            router.refresh()
        } catch (err: any) {
            toast.error(err.message ?? "Failed to create project")
        } finally {
            setPending(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="flex gap-3">
            <Input
                placeholder="Project name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="max-w-sm"
                required
            />
            <Button type="submit" disabled={pending || !name.trim()}>
                {pending ? "Creating…" : "Create"}
            </Button>
        </form>
    )
}
