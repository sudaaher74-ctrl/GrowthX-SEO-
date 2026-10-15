import { Suspense } from 'react';
import { VisibilityJourneyPage } from '@/components/ai-visibility/visibility-journey';

export default function AiVisibilityJourneyRoute() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-brand-500">Loading AI Visibility Journey…</p>}>
      <VisibilityJourneyPage />
    </Suspense>
  );
}
