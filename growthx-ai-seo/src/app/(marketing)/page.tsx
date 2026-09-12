import { LandingHeader } from "@/components/marketing/landing-header";
import { HeroSection } from "@/components/marketing/hero-section";
import { FeatureCards } from "@/components/marketing/feature-cards";
import { ValueSection } from "@/components/marketing/value-section";
import { WorkflowSteps } from "@/components/marketing/workflow-steps";
import { TrustSection } from "@/components/marketing/trust-section";
import { FinalCTA } from "@/components/marketing/final-cta";
import { LandingFooter } from "@/components/marketing/landing-footer";

export default function LandingPage() {
  return (
    <>
      <LandingHeader />
      <main>
        <HeroSection />
        <FeatureCards />
        <ValueSection />
        <WorkflowSteps />
        <TrustSection />
        <FinalCTA />
      </main>
      <LandingFooter />
    </>
  );
}
