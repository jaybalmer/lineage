import type { Metadata } from "next"
import Link from "next/link"
import { LegalPage, LegalSection, LEGAL_CONTACT } from "@/components/legal/legal-shell"

const META_DESCRIPTION =
  "How Linestry collects, uses, and protects your personal information. We do not sell personal information and we do not run advertising."

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: META_DESCRIPTION,
  alternates: { canonical: "/privacy" },
  openGraph: {
    type: "article",
    url: "/privacy",
    siteName: "Linestry",
    title: "Privacy Policy",
    description: META_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "Privacy Policy",
    description: META_DESCRIPTION,
  },
}

const mailto = `mailto:${LEGAL_CONTACT}`

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      current="privacy"
      summary={
        <p>
          {`Linestry is a community-authored record of snowboarding history. We collect the account details needed to sign you in, the history you choose to record, and a small amount of usage data to keep the service working. We do not sell personal information and we do not run advertising.`}
        </p>
      }
    >
      <LegalSection id="who-we-are" title="1. Who we are">
        <p>
          {`Linestry is operated by Lineage Community Technologies Inc. ("Linestry", "we", "us"), a company incorporated in British Columbia, Canada. We are the organization responsible for the personal information described in this policy.`}
        </p>
        <p>
          {`Questions, access requests, and complaints go to `}
          <a href={mailto} className="text-accent-strong hover:underline">
            {LEGAL_CONTACT}
          </a>
          {`.`}
        </p>
      </LegalSection>

      <LegalSection id="what-we-collect" title="2. Information we collect">
        <p>
          <strong className="font-semibold text-foreground">{`Account information.`}</strong>
          {` When you create an account we collect your email address and display name. If you sign in with Google or Facebook, that provider sends us your name, email address, and profile picture URL. We do not receive your password, and we do not receive your friend list, posts, photos, or any other content from those accounts.`}
        </p>
        <p>
          <strong className="font-semibold text-foreground">{`Profile information you add.`}</strong>
          {` Username, avatar, home mountain, the year you started riding, era, bio, profile statement, and milestones. All of it optional beyond what is needed to create the account.`}
        </p>
        <p>
          <strong className="font-semibold text-foreground">{`History you record.`}</strong>
          {` Timeline claims (where you rode, who you rode with, boards you owned, events you entered), riding days, stories and their text, dates, photos, and any YouTube links you attach. Photos are uploaded to our storage buckets and keep whatever information is embedded in the file you upload.`}
        </p>
        <p>
          <strong className="font-semibold text-foreground">{`Information about other people.`}</strong>
          {` Linestry is a shared graph, so members add catalog records for riders, places, brands, boards, and events, and tag other people in their own history. This means records about you may exist before you ever create an account. See section 7.`}
        </p>
        <p>
          <strong className="font-semibold text-foreground">{`Payment information.`}</strong>
          {` Memberships are processed by Stripe. Stripe handles your card details directly; we never see or store a card number. We store the Stripe customer and subscription identifiers, your tier, and its status.`}
        </p>
        <p>
          <strong className="font-semibold text-foreground">{`Usage and diagnostic data.`}</strong>
          {` Page views, feature events (for example, starting onboarding or publishing a story), approximate location inferred from IP address by our analytics provider, browser and device type, and error reports when something breaks. Session replays are recorded with all input fields masked, so typed content such as emails, names, story bodies, and claim notes is not captured.`}
        </p>
        <p>
          <strong className="font-semibold text-foreground">{`Bug reports and support email.`}</strong>
          {` Whatever you choose to include when you file an in-app bug report or email us.`}
        </p>
      </LegalSection>

      <LegalSection id="how-we-use" title="3. How we use it">
        <ul className="list-disc space-y-2 pl-5">
          <li>{`To create and secure your account and sign you in.`}</li>
          <li>{`To build and display your timeline and the shared community graph.`}</li>
          <li>{`To send transactional email: sign-in links, tag notifications, comment notifications, claim decisions, and membership receipts.`}</li>
          <li>{`To process memberships and track token and equity-offer balances.`}</li>
          <li>{`To moderate contributions, review claim requests, and enforce our terms.`}</li>
          <li>{`To understand which parts of the product work, fix errors, and improve it.`}</li>
        </ul>
        <p>
          {`We do not sell personal information, we do not share it with advertisers, and we do not use your content to train third-party AI models.`}
        </p>
      </LegalSection>

      <LegalSection id="legal-basis" title="4. Our basis for using it">
        <p>
          {`In Canada we rely on your consent, given when you create an account and when you choose to publish content. Where the GDPR applies, we rely on: performance of a contract (running your account and membership), legitimate interests (security, moderation, product analytics, and maintaining an accurate historical record), consent (optional email and optional public sharing), and legal obligation (tax and accounting records).`}
        </p>
      </LegalSection>

      <LegalSection id="visibility" title="5. What is public and what is not">
        <p>
          {`Your timeline is private by default. Content becomes visible to others only when you choose it: by setting an entry's visibility, by turning on a public timeline at a public link, or by contributing a record to the shared catalog. Catalog entries (people, places, brands, boards, and events) are community data and are visible to other members by design.`}
        </p>
        <p>
          {`Anything you publish publicly can be seen, copied, indexed by search engines, and archived by third parties. Turning public sharing off stops future access through Linestry but cannot retrieve copies already made elsewhere.`}
        </p>
      </LegalSection>

      <LegalSection id="facebook" title="6. Facebook Login and Google Sign-In">
        <p>
          {`If you choose "Continue with Facebook" or "Continue with Google", we request only the basic profile fields listed in section 2 in order to create your Linestry account and match it to an existing email address if you already have one. We do not post to your Facebook or Google account, we do not read your friends, contacts, or feed, and we do not import content from those services.`}
        </p>
        <p>
          {`You can disconnect Linestry at any time from your Facebook settings (Settings and Privacy, then Settings, then Apps and Websites) or your Google account permissions page. Disconnecting stops future sign-ins with that provider; to remove data already stored on Linestry, follow the `}
          <Link href="/data-deletion" className="text-accent-strong hover:underline">
            data deletion instructions
          </Link>
          {`.`}
        </p>
      </LegalSection>

      <LegalSection id="about-others" title="7. Information about people who are not members">
        <p>
          {`Members can add a rider to the catalog and tag them in their own history. These unclaimed records exist so that history can be recorded accurately, and they hold only what a member contributed: a name, and the claims or stories that reference it.`}
        </p>
        <p>
          {`If a record refers to you, you can claim it and take ownership of the profile, set tag approval so that future tags need your consent, block specific members, or ask us to remove the record entirely. Write to `}
          <a href={mailto} className="text-accent-strong hover:underline">
            {LEGAL_CONTACT}
          </a>
          {` and we will act on it. You do not need an account to make that request.`}
        </p>
      </LegalSection>

      <LegalSection id="processors" title="8. Service providers">
        <p>
          {`We use a small set of processors, each bound to use the data only to provide their service to us:`}
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="font-semibold text-foreground">{`Supabase`}</strong>
            {`: database, authentication, and file storage.`}
          </li>
          <li>
            <strong className="font-semibold text-foreground">{`Vercel`}</strong>
            {`: application hosting and request logs.`}
          </li>
          <li>
            <strong className="font-semibold text-foreground">{`Stripe`}</strong>
            {`: payment processing for memberships.`}
          </li>
          <li>
            <strong className="font-semibold text-foreground">{`Resend`}</strong>
            {`: delivery of transactional email.`}
          </li>
          <li>
            <strong className="font-semibold text-foreground">{`PostHog`}</strong>
            {`: product analytics and masked session replay.`}
          </li>
          <li>
            <strong className="font-semibold text-foreground">{`Sentry`}</strong>
            {`: error and performance monitoring.`}
          </li>
          <li>
            <strong className="font-semibold text-foreground">{`Google`}</strong>
            {` and `}
            <strong className="font-semibold text-foreground">{`Meta Platforms`}</strong>
            {`: only if you choose their sign-in button.`}
          </li>
        </ul>
        <p>
          {`We also embed YouTube players when a member attaches a video. Loading an embedded player contacts Google's servers and is subject to Google's privacy policy.`}
        </p>
      </LegalSection>

      <LegalSection id="transfers" title="9. Where data is stored">
        <p>
          {`Linestry is a Canadian company, but our providers operate in the United States and other countries, so your information is stored and processed outside Canada and may be accessible to courts and authorities in those jurisdictions. Where the GDPR applies, transfers rely on our providers' standard contractual clauses.`}
        </p>
      </LegalSection>

      <LegalSection id="retention" title="10. How long we keep it">
        <p>
          {`We keep your account and the history you record for as long as your account is open. Analytics and error data are kept for up to 24 months. Payment records are kept for seven years as required for Canadian tax purposes. When you ask us to delete your account, we follow the timelines set out in the `}
          <Link href="/data-deletion" className="text-accent-strong hover:underline">
            data deletion instructions
          </Link>
          {`.`}
        </p>
      </LegalSection>

      <LegalSection id="rights" title="11. Your choices and rights">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="font-semibold text-foreground">{`Access and correction.`}</strong>
            {` You can edit your profile and entries in the app, and you can ask us for a copy of everything we hold about you.`}
          </li>
          <li>
            <strong className="font-semibold text-foreground">{`Deletion.`}</strong>
            {` See the `}
            <Link href="/data-deletion" className="text-accent-strong hover:underline">
              data deletion instructions
            </Link>
            {`.`}
          </li>
          <li>
            <strong className="font-semibold text-foreground">{`Email preferences.`}</strong>
            {` Notification email can be turned off in your settings or through the unsubscribe link in any message. Sign-in and receipt emails are operational and cannot be turned off while your account is open.`}
          </li>
          <li>
            <strong className="font-semibold text-foreground">{`Tagging.`}</strong>
            {` You can require approval before other members tag you, and you can block individual members.`}
          </li>
          <li>
            <strong className="font-semibold text-foreground">{`Public sharing.`}</strong>
            {` You can turn your public timeline on or off at any time.`}
          </li>
        </ul>
        <p>
          {`If you are in the EU or UK you also have rights to portability, restriction, objection, and to complain to your supervisory authority. If you are a California resident you have the rights to know, delete, correct, and to opt out of sale or sharing. We do not sell or share personal information as those terms are defined. If you are in Canada and are not satisfied with our response, you can contact the Office of the Privacy Commissioner of Canada or the Office of the Information and Privacy Commissioner for British Columbia.`}
        </p>
      </LegalSection>

      <LegalSection id="security" title="12. Security">
        <p>
          {`Access to the database is governed by row-level security, traffic is encrypted in transit, and administrative access is limited to the people who need it. No service can promise perfect security; if a breach creates a real risk of significant harm we will notify affected members and the relevant regulator as the law requires.`}
        </p>
      </LegalSection>

      <LegalSection id="children" title="13. Children">
        <p>
          {`Linestry is not directed at children under 13, and we do not knowingly collect their personal information. If you believe a child has created an account, write to `}
          <a href={mailto} className="text-accent-strong hover:underline">
            {LEGAL_CONTACT}
          </a>
          {` and we will remove it.`}
        </p>
      </LegalSection>

      <LegalSection id="changes" title="14. Changes to this policy">
        <p>
          {`We will update this page when our practices change and revise the effective date above. For material changes affecting how we use information you have already given us, we will notify members by email or in the app before the change takes effect.`}
        </p>
      </LegalSection>
    </LegalPage>
  )
}
