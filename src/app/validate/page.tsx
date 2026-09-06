"use client";

import { useEffect, useState } from "react";
import type { CatalogProject } from "@/lib/catalogProject";
import type { FeedRow } from "@/lib/facebook";
import Link from "next/link";
import { validateCatalog, type CatalogValidationResult } from "@/lib/catalogValidation";

type PreviewRow = FeedRow;

export default function ValidatePage() {
  const [projectId] = useState(() => typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("projectId") || "");
  const [domain, setDomain] = useState("store.gibun.at");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ totalFetched: number; totalPhysical: number } | null>(null);
  const [validation, setValidation] = useState<CatalogValidationResult | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(projectId
        ? `/api/projects?id=${encodeURIComponent(projectId)}`
        : `/api/preview?domain=${encodeURIComponent(domain)}`);
      const json = await res.json() as (CatalogProject & { error?: string }) | {
        error?: string;
        preview: PreviewRow[];
        totalFetched: number;
        totalPhysical: number;
        validation: CatalogValidationResult;
      };
      if (!res.ok) throw new Error(json.error);
      if (projectId) {
        const project = json as CatalogProject;
        setRows(project.products);
        setDomain(project.source.value);
        setMeta({
          totalFetched: project.importStatus.totalRows,
          totalPhysical: project.importStatus.totalProducts,
        });
        setValidation(project.validation ?? validateCatalog(project.products, { importComplete: project.importStatus.complete }));
      } else {
        const preview = json as { preview: PreviewRow[]; totalFetched: number; totalPhysical: number; validation: CatalogValidationResult };
        setRows(preview.preview);
        setMeta({ totalFetched: preview.totalFetched, totalPhysical: preview.totalPhysical });
        setValidation(preview.validation);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Fetch the persisted catalog once when opening a project validation URL.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (projectId) void run();
    // The project is an immutable catalog snapshot until it is explicitly reimported.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const editorHref = projectId ? `/editor?projectId=${encodeURIComponent(projectId)}` : "/editor";

  const hasErrors = validation?.status === "blocked";
  const hasWarnings = validation?.status === "needs-review";

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 flex flex-col">
      <header className="border-b bg-white sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/" className="font-semibold">Catalog Forge</Link>
          <span className="text-zinc-300">/</span>
          <span className="text-sm font-medium">Validate — Feed Linter</span>
          <div className="ml-auto flex gap-2">
            <Link href="/" className="text-xs px-3 py-1 border rounded">Feed</Link>
            <Link href={editorHref} className="text-xs px-3 py-1 border rounded">Editor</Link>
            {process.env.NODE_ENV !== 'production' && <Link href="/story-map" className="text-xs px-3 py-1 border rounded">Story Map</Link>}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto w-full px-4 py-6 space-y-6">
        <div className="bg-white rounded-xl border p-6 space-y-4">
          <h1 className="text-lg font-semibold">Meta Feed Auditor (like Marpipe Feed Auditor)</h1>
          <p className="text-sm text-zinc-600">Checks the complete catalog for required Meta fields, duplicate IDs, absolute links, ISO currency prices, sale-price consistency, stock, and import completeness. Image dimensions remain marked for review until a remote image check has run.</p>
          <div className="flex gap-2">
            <input value={domain} onChange={(e) => setDomain(e.target.value)} disabled={Boolean(projectId)} className="flex-1 border rounded px-3 py-2 font-mono text-sm disabled:bg-zinc-50" placeholder="store.gibun.at" />
            <button onClick={run} disabled={loading} className="px-6 py-2 bg-zinc-900 text-white rounded text-sm disabled:opacity-50">{loading ? "Linting…" : "Lint Feed"}</button>
          </div>
          <div className="flex gap-2 text-xs">
            <button onClick={() => setDomain("store.gibun.at")} className="underline">store.gibun.at</button>
            <span className="text-zinc-300">|</span>
            <span className="text-zinc-400">Shows the 1 missing-image SKU as error (Not My Drama Nachfüllpackung)</span>
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">{error}</div>}

        {meta && (
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white border rounded-xl p-4"><div className="text-xs text-zinc-500">Fetched</div><div className="text-2xl font-semibold">{meta.totalFetched}</div></div>
            <div className="bg-white border rounded-xl p-4"><div className="text-xs text-zinc-500">Physical</div><div className="text-2xl font-semibold">{meta.totalPhysical}</div></div>
            <div className={`border rounded-xl p-4 ${hasErrors ? "bg-red-50 border-red-200" : hasWarnings ? "bg-amber-50 border-amber-200" : "bg-green-50 border-green-200"}`}>
              <div className="text-xs">{hasErrors ? "Blocked" : hasWarnings ? "Review needed" : "Ready"}</div>
              <div className="text-sm font-medium">{hasErrors ? `${validation?.errorCount ?? 0} blocking findings must be fixed` : hasWarnings ? `${validation?.warningCount ?? 0} checks still need review` : "All automated catalog checks passed"}</div>
              {validation?.currencyCodes.length ? <div className="mt-1 font-mono text-xs">{validation.currencyCodes.join(", ")}</div> : null}
            </div>
          </div>
        )}

        {validation && (
          <div className="space-y-3">
            {validation.issues.map((issue) => (
              <div key={issue.code} className={`rounded-xl border p-4 ${issue.severity === "error" ? "bg-red-50 border-red-200" : issue.severity === "warning" ? "bg-amber-50 border-amber-200" : "bg-blue-50 border-blue-200"}`}>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${issue.severity === "error" ? "bg-red-600 text-white" : issue.severity === "warning" ? "bg-amber-500 text-white" : "bg-blue-600 text-white"}`}>{issue.severity.toUpperCase()}</span>
                  <span className="text-sm font-medium">{issue.message}</span>
                  <span className="ml-auto text-sm font-mono">{issue.count}{issue.rowIndexes.length ? ` / ${validation.rowCount}` : ""}</span>
                </div>
                {issue.rowIndexes.length > 0 && (
                  <details className="mt-2">
                    <summary className="text-xs cursor-pointer">Show affected product IDs ({issue.count})</summary>
                    <div className="mt-2 grid gap-2">
                      {issue.rowIndexes.slice(0, 10).map((rowIndex, itemIndex) => {
                        const row = rows[rowIndex];
                        const id = issue.productIds[itemIndex];
                        return (
                          <div key={`${rowIndex}-${id}`} className="flex gap-2 items-center text-xs bg-white border rounded px-3 py-2">
                            <span className="font-mono w-32 truncate">{id}</span>
                            <span className="flex-1 truncate">{row?.title || `Catalog row ${rowIndex + 1}`}</span>
                            {row?.price && <span className="font-mono">{row.price}</span>}
                            {row?.link && <a href={row.link} target="_blank" rel="noreferrer" className="text-blue-600 underline">link</a>}
                          </div>
                        );
                      })}
                      {issue.count > 10 && <div className="text-xs text-zinc-500">+{issue.count - 10} more…</div>}
                    </div>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}

        {validation && !hasErrors && (
          <div className="bg-violet-600 text-white rounded-xl p-6 flex items-center justify-between">
            <div>
              <div className="font-medium">{validation.status === "ready" ? "Catalog checks passed" : "Catalog can be designed while warnings are reviewed"}</div>
              <div className="text-sm opacity-80">Open the editor with this same saved catalog and design selection.</div>
            </div>
            <Link href={editorHref} className="px-4 py-2 bg-white text-violet-600 rounded text-sm font-medium">Open Editor →</Link>
          </div>
        )}
      </main>
    </div>
  );
}
