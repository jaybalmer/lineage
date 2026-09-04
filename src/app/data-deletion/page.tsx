import type { Metadata } from "next"
import Link from "next/link"
import { LegalPage, LegalSection, LEGAL_CONTACT } from "@/components/legal/legal-shell"

const META_DESCRIPTION =
  "How to remove your entries or delete your whole Linestry account and the personal information attached to it."

export const metadata: Metadata = {
  title: "Deleting your data",
  description: META_DESCRIPTION,
  alternates: { canonical: "/data-deletion" },
  openGraph: {
    type: "article",
    url: "/data-deletion",
    siteName: "Linestry",
    title: "Deleting your data",
    description: META_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "Deleting your data",
    description: META_DESCRIPTION,
  },
}

const deleteMailto = `mailto:${LEGAL_CONTACT}?subject=Delete%20my%20Linestry%20account`

export default function DataDeletionPage() {
  return (
    <LegalPage
      title="Deleting your data"
      current="data-deletion"
      summary={
        <p>
          {`You can remove individual entries yourself at any time. To delete your whole account and the personal information attached to it, email us and we will confirm within 5 business days and complete the deletion within 30 days.`}
        </p>
      }
    >
      <LegalSection id="yourself" title="1. Removing things yourself">
        <p>
          {`While your account is open you can delete any story, claim, riding day, or photo you have added from the entry itself, edit or clear your profile fields, and switch your public timeline off in Settings. Removing an entry takes it out of the app immediately.`}
        </p>
      </LegalSection>

      <LegalSection id="account" title="2. Deleting your whole account">
        <p>
          {`Send an email to `}
          <a href={deleteMailto} className="text-accent-strong hover:underline">
            {LEGAL_CONTACT}
          </a>
          {` from the email address on your account, with the subject `}
          <strong className="font-semibold text-foreground">{`Delete my Linestry account`}</strong>
          {`. Tell us your username if you have one.`}
        </p>
        <p>
          {`If you cannot send from that address (for example you signed up with Facebook or Google and no longer have access to that mailbox), write to us anyway and we will verify your identity another way before we delete anything.`}
        </p>
        <p>{`What happens next:`}</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="font-semibold text-foreground">{`Within 5 business days`}</strong>
            {` we confirm the request and tell you exactly what will be removed.`}
          </li>
          <li>
            <strong className="font-semibold text-foreground">{`Within 30 days`}</strong>
            {` we delete your account, your profile, your stories and photos, your private claims and riding days, your tags, your notification and privacy settings, and your analytics profile.`}
          </li>
          <li>
            <strong className="font-semibold text-foreground">{`Within 90 days`}</strong>
            {` the deletion works through our encrypted backups, which are rotated on that cycle.`}
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="facebook" title="3. If you signed in with Facebook or Google">
        <p>
          {`Disconnecting Linestry from Facebook (Settings and Privacy, then Settings, then Apps and Websites, then Linestry, then Remove) or from your Google account permissions page stops us receiving anything further from that provider and stops that sign-in method working. It does not by itself delete the account you built on Linestry. For that, send the email in section 2, and we will treat it as a deletion request covering the profile data the provider gave us.`}
        </p>
      </LegalSection>

      <LegalSection id="kept" title="4. What we keep, and why">
        <p>
          {`A few things survive an account deletion, and it is fairer to say so plainly than to surprise you later:`}
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="font-semibold text-foreground">{`Shared catalog records.`}</strong>
            {` Places, brands, boards, events, and riders you added to the community catalog stay in the graph as historical facts, disassociated from you. Ask us and we will remove your name from their attribution.`}
          </li>
          <li>
            <strong className="font-semibold text-foreground">{`Other members' history.`}</strong>
            {` If another member recorded that they rode with you, that is their entry about their own life. Ask us and we will remove the reference to you from it.`}
          </li>
          <li>
            <strong className="font-semibold text-foreground">{`Payment records.`}</strong>
            {` Invoices and transaction records are retained for seven years for Canadian tax and accounting purposes.`}
          </li>
          <li>
            <strong className="font-semibold text-foreground">{`Suppression records.`}</strong>
            {` We keep a minimal record of an unsubscribed or deleted email address so we do not email you again by mistake.`}
          </li>
          <li>
            <strong className="font-semibold text-foreground">{`Moderation records.`}</strong>
            {` Where an account was removed for abuse we keep enough to enforce that decision.`}
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="export" title="5. Getting a copy first">
        <p>
          {`If you would like an export of your timeline, stories, and photos before we delete anything, ask for it in the same email and we will send it before the deletion runs.`}
        </p>
      </LegalSection>

      <LegalSection id="contact" title="6. Contact">
        <p>
          {`Lineage Community Technologies Inc., British Columbia, Canada. `}
          <a href={`mailto:${LEGAL_CONTACT}`} className="text-accent-strong hover:underline">
            {LEGAL_CONTACT}
          </a>
          {`. See also our `}
          <Link href="/privacy" className="text-accent-strong hover:underline">
            Privacy Policy
          </Link>
          {`.`}
        </p>
      </LegalSection>
    </LegalPage>
  )
}
