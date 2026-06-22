import { Trash2 } from "lucide-react"
import { listProjects, deleteProject } from "./actions"
import { Button } from "@/components/ui/button"

export async function ProjectsList() {
    const projects = await listProjects()

    if (projects.length === 0) {
        return (
            <p className="text-muted-foreground text-sm">
                No projects yet. Create your first one above.
            </p>
        )
    }

    return (
        <div className="space-y-2">
            {projects.map((project) => (
                <div
                    key={project.id}
                    className="flex items-center justify-between rounded-lg border px-4 py-3"
                >
                    <div>
                        <p className="font-medium">{project.name}</p>
                        <p className="text-muted-foreground text-xs">
                            {project.createdAt.toLocaleDateString()}
                        </p>
                    </div>
                    <form
                        action={async () => {
                            "use server"
                            await deleteProject(project.id)
                        }}
                    >
                        <Button
                            variant="ghost"
                            size="icon"
                            type="submit"
                            className="text-muted-foreground hover:text-destructive"
                        >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Delete</span>
                        </Button>
                    </form>
                </div>
            ))}
        </div>
    )
}
