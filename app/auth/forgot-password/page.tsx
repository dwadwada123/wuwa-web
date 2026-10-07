import { ForgotPasswordForm } from "./forgot-password-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Reset Password | Wuthering Waves Optimizer",
  description: "Request a password reset link for your account",
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
