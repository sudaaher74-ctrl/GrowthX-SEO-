import { LandingHeader } from "@/components/marketing/landing-header";
import { HeroSection } from "@/components/marketing/hero-section";
import { ProofStrip } from "@/components/marketing/proof-strip";
import { ProblemSection } from "@/components/marketing/problem-section";
import { HowItWorksSection } from "@/components/marketing/how-it-works-section";
import { ProductShowcaseSection } from "@/components/marketing/product-showcase-section";
import { UnderTheHoodSection } from "@/components/marketing/under-the-hood-section";
import { CostComparison } from "@/components/marketing/cost-comparison";
import { FaqSection } from "@/components/marketing/faq-section";
import { FinalCTA } from "@/components/marketing/final-cta";
import { LandingFooter } from "@/components/marketing/landing-footer";

export default function LandingPage() {
  return (
    <>
      <LandingHeader />
      <main>
        {/* 1. Hero with URL audit box & live Battleground mockup */}
        <HeroSection />

        {/* 2. Proof strip */}
        <ProofStrip />

        {/* 3. Problem */}
        <ProblemSection />

        {/* 4. How it works */}
        <HowItWorksSection />

        {/* 5–9. Product showcase: One platform. Five jobs done. */}
        <ProductShowcaseSection />

        {/* 10. Under the hood + who it's for */}
        <UnderTheHoodSection />

        {/* 11a. Cost comparison & pricing teaser with currency switch */}
        <CostComparison />

        {/* 11b. FAQ */}
        <FaqSection />

        {/* Final CTA */}
        <FinalCTA />
      </main>
      <LandingFooter />
    </>
  );
}
