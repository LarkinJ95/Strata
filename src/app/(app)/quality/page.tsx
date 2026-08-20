import { redirect } from "next/navigation";

export default async function DataQualityPage() {
  redirect("/settings?tab=data-quality");
}
