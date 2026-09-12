import { LandingHeader } from "@/components/marketing/landing-header";
import { HeroSection } from "@/components/marketing/hero-section";
import { FeatureCards } from "@/components/marketing/feature-cards";
import { WorkflowSteps } from "@/components/marketing/workflow-steps";
import { TrustSection } from "@/components/marketing/trust-section";
import { FinalCTA } from "@/components/marketing/final-cta";
import { LandingFooter } from "@/components/marketing/landing-footer";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white text-slate-900">
      <LandingHeader />
      <main className="flex-1">
        <HeroSection />
        <FeatureCards />
        <WorkflowSteps />
        <TrustSection />
        <FinalCTA />
      </main>
      <LandingFooter />
    </div>
  );
}
