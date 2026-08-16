"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthShell, Field, SubmitButton } from "@/components/auth/auth-shell";
import { api, auth } from "@/lib/api-client";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.login(form.email, form.password);

      // Pick up the caller's first organization so the dashboard has a
      // workspace to scope every query to.
      const orgs = await api.listOrganizations();
      if (orgs?.[0]?.id) auth.setOrgId(orgs[0].id);

      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Sign in"
      subtitle="Access your GrowthX workspace."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link href="/register" className="font-semibold hover:underline" style={{ color: "#7c3aed" }}>
            Create one
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
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
          autoComplete="current-password"
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
          <SubmitButton busy={busy}>{busy ? "Signing in…" : "Sign in"}</SubmitButton>
        </div>
      </form>
    </AuthShell>
  );
}
