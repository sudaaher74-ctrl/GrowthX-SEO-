import type { ResearchAnswer, ResearchSource } from "@/lib/api-client";

/** One question and the answer it produced, with that run's sources. */
export interface Turn {
  question: string;
  answer: ResearchAnswer;
  sources: ResearchSource[];
}
