import { LandingHeader } from "@/components/marketing/landing-header";
import { HeroSection } from "@/components/marketing/hero-section";
import { ProofStrip } from "@/components/marketing/proof-strip";
import { TrustSection } from "@/components/marketing/trust-section";
import { WorkflowSteps } from "@/components/marketing/workflow-steps";
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

        {/* 2. Proof Strip: Real partner brands & live metric counters */}
        <ProofStrip />

        {/* 3. The Problem: SEO got harder, tools didn't get smarter */}
        <TrustSection />

        {/* 4. How It Works: From URL to results in 4 steps */}
        <WorkflowSteps />

        {/* 5-9. FeatureCards: Five engines with live preview widgets */}
        <FeatureCards />

        {/* 10. ValueSection: Under the hood + who it's for */}
        <ValueSection />

        {/* 11a. CostComparison: Pricing, ROI calculator & comparison matrix */}
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
