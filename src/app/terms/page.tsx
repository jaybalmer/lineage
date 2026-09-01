import type { Metadata } from "next"
import Link from "next/link"
import { LegalPage, LegalSection, LEGAL_CONTACT } from "@/components/legal/legal-shell"

const META_DESCRIPTION =
  "The terms of service for Linestry, the shared record of snowboarding history that members build together."

export const metadata: Metadata = {
  title: "Terms of Service",
  description: META_DESCRIPTION,
  alternates: { canonical: "/terms" },
  openGraph: {
    type: "article",
    url: "/terms",
    siteName: "Linestry",
    title: "Terms of Service",
    description: META_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "Terms of Service",
    description: META_DESCRIPTION,
  },
}

const mailto = `mailto:${LEGAL_CONTACT}`

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      current="terms"
      summary={
        <p>
          {`Linestry is a shared record of snowboarding history that members build together. You keep ownership of what you contribute and give us the licence we need to display it. In exchange, you agree to contribute honestly, to respect the people you record, and to accept that a community archive is edited by more than one hand.`}
        </p>
      }
    >
      <LegalSection id="agreement" title="1. The agreement">
        <p>
          {`These terms are a contract between you and Lineage Community Technologies Inc. ("Linestry", "we", "us"), covering linestry.com and everything on it. By creating an account or using the service you accept them. If you do not, do not use Linestry.`}
        </p>
        <p>
          {`Our `}
          <Link href="/privacy" className="text-accent-strong hover:underline">
            Privacy Policy
          </Link>
          {` and `}
          <Link href="/data-deletion" className="text-accent-strong hover:underline">
            data deletion instructions
          </Link>
          {` are part of these terms.`}
        </p>
      </LegalSection>

      <LegalSection id="eligibility" title="2. Eligibility and your account">
        <p>
          {`You must be at least 13 years old to use Linestry, and old enough to form a binding contract where you live. You are responsible for what happens under your account and for keeping access to your email or connected sign-in provider secure. One account per person; do not impersonate anyone, and do not create an account on someone else's behalf without their permission.`}
        </p>
        <p>
          {`You can sign in with an email link, a password, or a connected Google or Facebook account. If a connected provider changes or removes its service, we may need to change how sign-in works.`}
        </p>
      </LegalSection>

      <LegalSection id="your-content" title="3. Your content">
        <p>
          {`You keep ownership of the stories, photos, claims, and other material you contribute. You grant us a worldwide, non-exclusive, royalty-free licence to host, store, reproduce, adapt for display, and publish that material for the purpose of operating and promoting Linestry, and to allow other members to view it according to the visibility you set. This licence lasts as long as your content is on Linestry and for a reasonable period after removal while backups age out.`}
        </p>
        <p>
          {`You confirm that you own or have the right to post what you upload, including photographs taken by someone else. If you post a photo you did not take, credit the photographer and have their permission.`}
        </p>
        <p>
          <strong className="font-semibold text-foreground">{`Community catalog records are different.`}</strong>
          {` Entries you add to the shared catalog (people, places, brands, boards, events, and the factual relationships between them) become part of a collective record that other members can extend, correct, and build on. Facts about the history of the sport are not owned by whoever typed them first. Deleting your account does not withdraw those factual records from the graph, although we will disassociate them from you on request.`}
        </p>
      </LegalSection>

      <LegalSection id="about-others" title="4. Recording other people">
        <p>
          {`Linestry works because members record who they rode with. When you tag a person, add a rider to the catalog, or name someone in a story, you are making a public-facing claim about a real person. You agree to:`}
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>{`record only what you believe to be true, and mark uncertainty honestly using the confidence and approximate-date fields rather than guessing with certainty;`}</li>
          <li>{`respect a member's tag-approval setting and any block they have placed;`}</li>
          <li>{`keep private details private. Home addresses, contact information, health, and personal circumstances do not belong in a riding history;`}</li>
          <li>{`remove or correct an entry when the person it names asks you to, or when we ask on their behalf.`}</li>
        </ul>
        <p>
          {`Anyone named on Linestry can claim their profile, request corrections, or ask for removal by writing to `}
          <a href={mailto} className="text-accent-strong hover:underline">
            {LEGAL_CONTACT}
          </a>
          {`, whether or not they are a member.`}
        </p>
      </LegalSection>

      <LegalSection id="conduct" title="5. Acceptable use">
        <p>{`Do not use Linestry to:`}</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>{`post false history, fabricate results, or claim accomplishments that are not yours;`}</li>
          <li>{`harass, threaten, defame, or out anyone;`}</li>
          <li>{`post unlawful, hateful, or sexually explicit material, or material involving minors inappropriately;`}</li>
          <li>{`infringe copyright, trademark, or other rights;`}</li>
          <li>{`scrape, bulk-download, or resell the catalog, or use it to train a commercial model without our written permission;`}</li>
          <li>{`probe or interfere with the security of the service, or automate access in a way that degrades it for others.`}</li>
        </ul>
      </LegalSection>

      <LegalSection id="moderation" title="6. Moderation and corrections">
        <p>
          {`Linestry is an edited archive. Editors and administrators may merge duplicate records, correct dates and attributions, decline claim requests, resolve competing accounts of the same event, hide or remove content that breaks these terms, and archive accounts. Where a decision affects your own contributions we will tell you and explain why, and you can reply to contest it.`}
        </p>
        <p>
          {`If you believe content on Linestry infringes your copyright, send us the work, its location on Linestry, your contact details, and a statement of your good-faith belief at `}
          <a href={mailto} className="text-accent-strong hover:underline">
            {LEGAL_CONTACT}
          </a>
          {`. We remove infringing material promptly and repeat infringers lose their accounts.`}
        </p>
      </LegalSection>

      <LegalSection id="membership" title="7. Memberships and payment">
        <p>
          {`Linestry is free to use. Paid memberships (Annual, Lifetime, and the launch Founding cohort) unlock additional features and are billed through Stripe in the currency shown at checkout, plus applicable taxes. Annual memberships renew automatically at the then-current price until cancelled; you can cancel at any time from your membership settings and keep access until the end of the paid period.`}
        </p>
        <p>
          {`Prices and the features attached to each tier can change; we will give notice before a change affects a renewal. Except where consumer law requires otherwise, payments are non-refundable, though we would rather sort out a genuine problem than stand on that, so write to us.`}
        </p>
      </LegalSection>

      <LegalSection id="tokens" title="8. Tokens and the equity offer">
        <p>
          {`Members earn tokens for contributing history. Tokens are a record of contribution inside Linestry. They are not currency, not a cryptocurrency, have no cash value, cannot be bought, sold, or transferred, and confer no rights on their own. We may adjust how tokens are earned and weighted, and we reverse tokens earned through spam or fabricated entries.`}
        </p>
        <p>
          {`Any equity offer described on Linestry is a separate, limited offer made by Lineage Community Technologies Inc. and is governed by its own offer documents and by applicable securities law. The pages describing it are explanatory, not an agreement, not a prospectus, and not an offer to sell securities in any jurisdiction where that would be unlawful. Nothing on Linestry is investment, tax, or legal advice; participation is subject to eligibility checks and to signing the actual subscription documents.`}
        </p>
      </LegalSection>

      <LegalSection id="our-ip" title="9. Our intellectual property">
        <p>
          {`The Linestry name, brand marks, interface, design system, and software are ours. These terms do not give you any right to use them beyond using the service as intended.`}
        </p>
      </LegalSection>

      <LegalSection id="termination" title="10. Ending it">
        <p>
          {`You can stop using Linestry at any time and ask us to delete your account through the `}
          <Link href="/data-deletion" className="text-accent-strong hover:underline">
            data deletion instructions
          </Link>
          {`. We can suspend or terminate an account that breaks these terms, or that puts other members or the integrity of the archive at risk. If we terminate your account without cause, we will refund the unused part of a paid membership.`}
        </p>
      </LegalSection>

      <LegalSection id="disclaimers" title="11. Disclaimers and liability">
        <p>
          {`Linestry is provided "as is". It is a community-authored archive: entries are contributed by members and are not verified by us, and we make no warranty that any record on it is accurate, complete, or fit for any purpose. Snowboarding is a risk sport; nothing on Linestry is safety or conditions advice.`}
        </p>
        <p>
          {`To the fullest extent the law allows, we are not liable for indirect, incidental, special, or consequential damages, or for lost data or lost profits. Our total liability for any claim relating to Linestry is limited to the greater of the amount you paid us in the twelve months before the claim, or CAD $100. Nothing here limits liability that cannot be limited by law, including under consumer protection legislation in your province or country.`}
        </p>
      </LegalSection>

      <LegalSection id="law" title="12. Governing law">
        <p>
          {`These terms are governed by the laws of the Province of British Columbia and the laws of Canada that apply there. The courts of British Columbia have exclusive jurisdiction, except that if you are a consumer resident elsewhere you keep the right to bring a claim in your own local courts.`}
        </p>
      </LegalSection>

      <LegalSection id="changes" title="13. Changes">
        <p>
          {`We will post updated terms here and revise the effective date. For material changes we will notify members by email or in the app before they take effect. Continuing to use Linestry after that means you accept the new terms.`}
        </p>
        <p>
          {`Questions about any of this: `}
          <a href={mailto} className="text-accent-strong hover:underline">
            {LEGAL_CONTACT}
          </a>
          {`.`}
        </p>
      </LegalSection>
    </LegalPage>
  )
}
