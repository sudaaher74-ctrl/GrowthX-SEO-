import { redirect } from "next/navigation";

export default function FixChangesPage() {
  redirect("/fix-engine?tab=results");
}
