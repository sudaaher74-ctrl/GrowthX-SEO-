"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthShell, Field, SubmitButton } from "@/components/auth/auth-shell";
import { api, auth } from "@/lib/api-client";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "", company: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.register({
        email: form.email,
        password: form.password,
        firstName: form.firstName,
        lastName: form.lastName,
      });

      // A user without an organization has nothing to attach a plan or a site to.
      // `POST /auth/register` already creates a default workspace, so adopt that
      // one — creating another here left every new account with two, which then
      // broke the backend's "caller belongs to exactly one org" fallback and
      // made the workspace switcher show a phantom second entry.
      const existing = await api.listOrganizations();
      let orgId = existing?.[0]?.id ?? null;

      if (!orgId) {
        const name = form.company.trim() || `${form.firstName || form.email.split("@")[0]}'s workspace`;
        const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${Date.now().toString(36)}`;
        const org = await api.createOrganization(name, slug);
        orgId = org?.id ?? null;
      }

      if (orgId) auth.setOrgId(orgId);

      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the account.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Create your workspace"
      subtitle="Start with a crawl of your first client's site."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-semibold underline underline-offset-2" style={{ color: "var(--color-brand-950)" }}>
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" autoComplete="given-name" value={form.firstName} onChange={set("firstName")} />
          <Field label="Last name" autoComplete="family-name" value={form.lastName} onChange={set("lastName")} />
        </div>
        <Field
          label="Agency name"
          hint="optional"
          value={form.company}
          onChange={set("company")}
          placeholder="Acme Growth"
        />
        <Field
          label="Email"
          type="email"
          required
          autoComplete="email"
          value={form.email}
          onChange={set("email")}
          placeholder="you@agency.com"
        />
        <Field
          label="Password"
          type="password"
          required
          autoComplete="new-password"
          value={form.password}
          onChange={set("password")}
          placeholder="••••••••"
        />

        {error && (
          <p
            role="alert"
            className="rounded-lg border px-3 py-2 text-[13px]"
            style={{ borderColor: "rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.07)", color: "var(--color-error-700)" }}
          >
            {error}
          </p>
        )}

        <div className="pt-1">
          <SubmitButton busy={busy}>{busy ? "Creating…" : "Create account"}</SubmitButton>
        </div>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">Or continue with</span>
          </div>
        </div>

        <a
          href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/auth/google`}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
            <path d="M1 1h22v22H1z" fill="none" />
          </svg>
          Google
        </a>
      </form>
    </AuthShell>
  );
}
