import { redirect } from "next/navigation";

export default function Page() {
  redirect("/google?tab=report");
}
