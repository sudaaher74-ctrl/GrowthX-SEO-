import { LandingHeader } from "@/components/marketing/landing-header";
import { HeroSection } from "@/components/marketing/hero-section";
import { ProofStrip } from "@/components/marketing/proof-strip";
import { TrustSection } from "@/components/marketing/trust-section";
import { WorkflowSteps } from "@/components/marketing/workflow-steps";
import { FeatureCards } from "@/components/marketing/feature-cards";
import { ProofLedger } from "@/components/marketing/proof-ledger";
import { ValueSection } from "@/components/marketing/value-section";
import { CostComparison } from "@/components/marketing/cost-comparison";
import { FaqSection } from "@/components/marketing/faq-section";
import { FinalCTA } from "@/components/marketing/final-cta";
import { LandingFooter } from "@/components/marketing/landing-footer";
import { FAQS } from "@/lib/faqs";
import { PLANS } from "@/lib/pricing";
import { SITE_URL } from "@/lib/site";

const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#org`,
      name: "Reigel",
      url: SITE_URL,
      email: "sudarshan@growthx.in",
    },
    {
      "@type": "SoftwareApplication",
      name: "Reigel AI SEO",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description:
        "Audits your website, tracks rivals and AI-assistant answers, and prepares the fixes as pull requests you approve.",
      publisher: { "@id": `${SITE_URL}/#org` },
      offers: PLANS.map((plan) => ({
        "@type": "Offer",
        name: plan.name,
        price: String(plan.monthly.INR),
        priceCurrency: "INR",
        url: `${SITE_URL}/pricing`,
      })),
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQS.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ],
};

export default function LandingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA).replace(/</g, "\\u003c") }}
      />
      <LandingHeader />
      <main>
        <HeroSection />
        <ProofStrip />
        <TrustSection />
        <WorkflowSteps />
        {/* The one claim no rival can make: every fix is checked after it ships. */}
        <ProofLedger />
        <FeatureCards />
        {/* Who it is for, and the rules that keep a fix safe. */}
        <ValueSection />
        <CostComparison />
        <FaqSection />

        {/* Final CTA */}
        <FinalCTA />
      </main>
      <LandingFooter />
    </>
  );
}
