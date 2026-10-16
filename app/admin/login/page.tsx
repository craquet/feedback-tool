import { LoginForm } from "@/components/LoginForm";

export const metadata = {
  title: "Sign in — Feedback Admin",
};

export default function AdminLoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm items-center">
      <div className="w-full rounded-lg border border-neutral-200 p-6 dark:border-neutral-800">
        <h1 className="mb-4 text-lg font-semibold">Feedback Admin</h1>
        <LoginForm />
      </div>
    </main>
  );
}
