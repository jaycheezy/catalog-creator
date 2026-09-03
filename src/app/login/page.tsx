"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") || "/editor";
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/login")
      .then((r) => r.json())
      .then((j) => {
        if (!j.configured) setOpen(true);
        else if (j.authenticated) window.location.href = next;
        else setOpen(false);
      })
      .catch(() => setOpen(false));
  }, [next]);

  if (open === null) return <div className="text-sm text-zinc-500">Checking…</div>;

  if (open) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-zinc-600">No password configured — dev mode is open. Set <code className="bg-zinc-100 px-1 rounded text-xs">ADMIN_PASSWORD</code> to lock writes in prod.</p>
        <a href={next} className="inline-flex px-4 py-2 bg-zinc-900 text-white rounded text-sm">Continue to editor →</a>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Login failed");
      window.location.href = next;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-sm text-zinc-600">Enter the admin password to access Catalog Forge. Feed/render URLs stay private share-links for Meta.</p>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Admin password"
        autoFocus
        className="w-full border rounded-lg px-4 py-2.5 text-sm"
      />
      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">{error}</div>}
      <button type="submit" disabled={loading || !password} className="w-full py-2.5 bg-zinc-900 text-white rounded-lg text-sm font-medium disabled:opacity-40">
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl border shadow-sm max-w-sm w-full p-6 space-y-4">
        <div>
          <a href="/" className="font-semibold tracking-tight">Catalog Forge</a>
          <h1 className="text-lg font-semibold mt-2">Sign in</h1>
        </div>
        <Suspense fallback={<div className="text-sm text-zinc-500">Loading…</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
