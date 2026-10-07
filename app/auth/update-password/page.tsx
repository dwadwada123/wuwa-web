import { redirect } from "next/navigation";
import { UpdatePasswordForm } from "./update-password-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Update Password | Wuthering Waves Optimizer",
  description: "Set a new password for your account",
};

export default async function UpdatePasswordPage({
  searchParams,
}: {
  searchParams?: Promise<{ code?: string; error?: string }> | { code?: string; error?: string };
}) {
  const resolved = searchParams ? await Promise.resolve(searchParams) : undefined;
  const code = resolved?.code;
  const error = resolved?.error;

  // If a PKCE code arrives directly at update-password, route through callback to exchange and establish cookies
  if (code) {
    redirect(`/auth/callback?code=${encodeURIComponent(code)}&next=/auth/update-password`);
  }

  return <UpdatePasswordForm initialError={error} />;
}
