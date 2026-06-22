import { Suspense } from "react"
import { PageHeader } from "@/components/layout/page-header"
import { ProjectsList } from "./projects-list"
import { CreateProjectForm } from "./create-project-form"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata = { title: "Projects" }

export default function ProjectsPage() {
    return (
        <div className="space-y-6">
            <PageHeader
                title="Projects"
                description="All projects belong to your active organization. Only your org can see them."
            />
            <CreateProjectForm />
            <Suspense fallback={<Skeleton className="h-40 w-full" />}>
                <ProjectsList />
            </Suspense>
        </div>
    )
}
