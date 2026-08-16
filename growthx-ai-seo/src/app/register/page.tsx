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

      // A user without an organization has nothing to attach a plan or a site
      // to, so create one immediately rather than leaving a half-set-up account.
      const name = form.company.trim() || `${form.firstName || form.email.split("@")[0]}'s workspace`;
      const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${Date.now().toString(36)}`;
      const org = await api.createOrganization(name, slug);
      if (org?.id) auth.setOrgId(org.id);

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
          <Link href="/login" className="font-semibold underline underline-offset-2" style={{ color: "#0a0a0a" }}>
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
            style={{ borderColor: "rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.07)", color: "#b91c1c" }}
          >
            {error}
          </p>
        )}

        <div className="pt-1">
          <SubmitButton busy={busy}>{busy ? "Creating…" : "Create account"}</SubmitButton>
        </div>
      </form>
    </AuthShell>
  );
}
