import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { organization } from "better-auth/plugins"
import { stripe } from "@better-auth/stripe"
import Stripe from "stripe"
import { Resend } from "resend"
import { EmailTemplate } from "@daveyplate/better-auth-ui/server"
import React from "react"
import { eq, and, inArray } from "drizzle-orm"
import { db } from "@/database/db"
import * as schema from "@/database/schema"
import { plans } from "@/lib/payments/plans"
import { site } from "@/config/site"
import { env } from "@/env"

const stripeClient = new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-06-30.basil",
    typescript: true
})

const resend = new Resend(env.RESEND_API_KEY)

export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: "pg",
        usePlural: true,
        schema
    }),
    emailAndPassword: {
        enabled: true,
        sendResetPassword: async ({ user, url }) => {
            const name = user.name || user.email.split("@")[0]
            await resend.emails.send({
                from: site.mailFrom,
                to: user.email,
                subject: "Reset your password",
                react: EmailTemplate({
                    heading: "Reset your password",
                    content: React.createElement(
                        React.Fragment,
                        null,
                        React.createElement("p", null, `Hi ${name},`),
                        React.createElement(
                            "p",
                            null,
                            "Someone requested a password reset for your account. If this was you, ",
                            "click the button below to reset your password."
                        ),
                        React.createElement(
                            "p",
                            null,
                            "If you didn't request this, you can safely ignore this email."
                        )
                    ),
                    action: "Reset Password",
                    url,
                    siteName: site.name,
                    baseUrl: site.url,
                    imageUrl: `${site.url}/logo.png`
                })
            })
        }
    },
    socialProviders: {
        ...(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
            ? { github: { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET } }
            : {}),
        ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
            ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } }
            : {}),
        ...(env.TWITTER_CLIENT_ID && env.TWITTER_CLIENT_SECRET
            ? { twitter: { clientId: env.TWITTER_CLIENT_ID, clientSecret: env.TWITTER_CLIENT_SECRET } }
            : {})
    },
    plugins: [
        organization({
            organizationCreation: {
                afterCreate: async ({ organization: org, user }) => {
                    const customer = await stripeClient.customers.create({
                        name: org.name,
                        email: user.email,
                        metadata: { organizationId: org.id }
                    })
                    await db
                        .update(schema.organizations)
                        .set({ stripeCustomerId: customer.id })
                        .where(eq(schema.organizations.id, org.id))
                }
            },
            sendInvitationEmail: async (data) => {
                const acceptUrl = `${env.BETTER_AUTH_URL}/dashboard/org/accept-invite?id=${data.id}`
                await resend.emails.send({
                    from: site.mailFrom,
                    to: data.email,
                    subject: `You've been invited to join ${data.organization.name}`,
                    react: EmailTemplate({
                        heading: `Join ${data.organization.name}`,
                        content: React.createElement(
                            "p",
                            null,
                            `${data.inviter.user.name || data.inviter.user.email} has invited you to join ${data.organization.name} as ${data.role}.`
                        ),
                        action: "Accept Invitation",
                        url: acceptUrl,
                        siteName: site.name,
                        baseUrl: env.BETTER_AUTH_URL,
                        imageUrl: `${site.url}/logo.png`
                    })
                })
            }
        }),
        stripe({
            stripeClient,
            stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET,
            // Stripe customers are created per-org in organizationCreation.afterCreate
            createCustomerOnSignUp: false,
            subscription: {
                enabled: true,
                plans,
                // Only org admins/owners can manage the org's subscription
                authorizeReference: async ({ user, referenceId }) => {
                    const member = await db.query.members.findFirst({
                        where: and(
                            eq(schema.members.organizationId, referenceId),
                            eq(schema.members.userId, user.id),
                            inArray(schema.members.role, ["owner", "admin"])
                        )
                    })
                    return !!member
                },
                // Inject the org's Stripe customer so billing is org-scoped
                getCheckoutSessionParams: async ({ session, subscription }) => {
                    const orgId = (session as any).activeOrganizationId as string | undefined
                    if (!orgId) return {}
                    const org = await db.query.organizations.findFirst({
                        where: eq(schema.organizations.id, orgId),
                        columns: { stripeCustomerId: true }
                    })
                    if (!org?.stripeCustomerId) return {}
                    // Align the subscription record before checkout completes
                    await db
                        .update(schema.subscriptions)
                        .set({ stripeCustomerId: org.stripeCustomerId })
                        .where(eq(schema.subscriptions.id, subscription.id))
                    return {
                        params: {
                            customer: org.stripeCustomerId,
                            customer_update: { name: "auto", address: "auto" }
                        }
                    }
                }
            }
        })
    ]
})
