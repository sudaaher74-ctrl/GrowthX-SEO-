import { LandingHeader } from "@/components/marketing/landing-header";
import { HeroSection } from "@/components/marketing/hero-section";
import { WorkflowSteps } from "@/components/marketing/workflow-steps";
import { TrustSection } from "@/components/marketing/trust-section";
import { FeatureCards } from "@/components/marketing/feature-cards";
import { ValueSection } from "@/components/marketing/value-section";
import { CostComparison } from "@/components/marketing/cost-comparison";
import { FaqSection } from "@/components/marketing/faq-section";
import { FinalCTA } from "@/components/marketing/final-cta";
import { LandingFooter } from "@/components/marketing/landing-footer";

export default function LandingPage() {
  return (
    <>
      <LandingHeader />
      <main>
        {/* 1. Hero with Battleground mockup & URL audit box */}
        <HeroSection />

        {/* 2 & 4. WorkflowSteps: From URL to results in 4 steps + Proof strip */}
        <WorkflowSteps />

        {/* 3. Problem & Pain Cards */}
        <TrustSection />

        {/* 5-9. FeatureCards: One platform. Five jobs done. */}
        <FeatureCards />

        {/* 10. ValueSection: Under the hood + who it's for */}
        <ValueSection />

        {/* 11a. CostComparison: Pricing teaser & comparison matrix */}
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
