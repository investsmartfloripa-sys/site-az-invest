import { redirect } from "next/navigation";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const errorParam = params.error ? `?error=${params.error}` : "";
  redirect(`/area-restrita/login${errorParam}`);
}
