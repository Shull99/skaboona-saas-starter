import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { PageHeader } from "@/components/layout/page-header"
import { OrgMembersTable } from "./members-table"
import { InviteForm } from "./invite-form"
import { OrgSwitcher } from "./org-switcher"

export const metadata = { title: "Organization" }

export default async function OrgPage() {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) redirect("/auth/sign-in")

    const orgId = (session.session as any).activeOrganizationId as string | undefined
    if (!orgId) redirect("/dashboard/org/create")

    const org = await auth.api.getFullOrganization({
        query: { organizationId: orgId },
        headers: await headers()
    })
    if (!org) redirect("/dashboard/org/create")

    const myMember = (org as any).members?.find((m: any) => m.userId === session.user.id)
    const isAdmin = myMember?.role === "owner" || myMember?.role === "admin"

    const allOrgs = await auth.api.listOrganizations({ headers: await headers() })

    return (
        <div className="space-y-8">
            <PageHeader
                title={`${(org as any).name}`}
                description="Manage your organization, members, and invitations."
            />

            {(allOrgs as any[]).length > 1 && (
                <section className="space-y-3">
                    <h2 className="font-semibold text-sm">Switch organization</h2>
                    <OrgSwitcher
                        orgs={allOrgs as any[]}
                        activeOrgId={orgId}
                    />
                </section>
            )}

            <section className="space-y-3">
                <h2 className="font-semibold text-sm">Members</h2>
                <OrgMembersTable
                    members={(org as any).members ?? []}
                    currentUserId={session.user.id}
                    currentRole={myMember?.role ?? "member"}
                    orgId={orgId}
                />
            </section>

            {isAdmin && (
                <section className="space-y-3">
                    <h2 className="font-semibold text-sm">Invite member</h2>
                    <InviteForm />
                </section>
            )}
        </div>
    )
}
