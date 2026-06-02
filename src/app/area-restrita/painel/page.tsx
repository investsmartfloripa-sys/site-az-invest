import { redirect } from "next/navigation";

export default function LegacyPainelPage() {
  redirect("/area-restrita/dashboard");
}
