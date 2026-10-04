import { redirect } from "next/navigation";

export default function GoogleHubPage() {
  // The former hub mixed live responses with presentation fallbacks (sample
  // countries, channels, landing pages and engagement). The combined overview
  // is the authoritative read model for both connection and data state.
  redirect("/google/overview");
}
