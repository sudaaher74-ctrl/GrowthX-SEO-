"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Globe, Loader2 } from "lucide-react";
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
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden p-4"
      style={{ background: "linear-gradient(135deg, #1f182c 0%, #2d1e42 40%, #1f2e26 100%)" }}
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        <div className="glass-strong rounded-2xl p-8">
          <div className="mb-8 flex flex-col items-center">
            <div className="gradient-bg-brand shadow-glow-brand mb-4 flex h-14 w-14 items-center justify-center rounded-2xl">
              <Globe size={26} className="text-white" />
            </div>
            <h1 className="text-h2 text-center text-white">Sign in</h1>
            <p className="mt-1 text-center text-sm text-slate-400">Access your GrowthX workspace</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Email" type="email" required value={form.email} onChange={set("email")} placeholder="you@business.in" />
            <Input label="Password" type="password" required value={form.password} onChange={set("password")} placeholder="••••••••" />

            {error && (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="gradient-bg-brand flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {busy && <Loader2 size={15} className="animate-spin" />}
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-400">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="font-semibold text-white hover:underline">
              Create one
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}

function Input({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-300">{label}</label>
      <input
        {...props}
        className="mt-1 w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-slate-500"
      />
    </div>
  );
}
