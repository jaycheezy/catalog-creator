'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import steps from '@/story-map/steps.json';
import { isReady, statusLabels, storyUrl, sliceUrl, notesUrl, unmetDependencies, type Slice, type Story } from '@/story-map/model';

const tones = { green: 'bg-emerald-50/70 border-emerald-100', blue: 'bg-sky-50/70 border-sky-100', violet: 'bg-indigo-50/70 border-indigo-100', amber: 'bg-amber-50/70 border-amber-100', zinc: 'bg-slate-100/70 border-slate-200' };
function StoryValue({ story }: { story: Story }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = `value-${story.id}`;
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open ]);
  return <div ref={rootRef} className="relative ml-auto">
    <button
      type="button"
      aria-expanded={open}
      aria-controls={panelId}
      aria-label={open ? `Hide why “${story.title}” matters` : `Show why “${story.title}” matters`}
      title="Why this matters"
      onClick={() => setOpen(value => !value)}
      className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-300 bg-white text-xs font-semibold text-slate-500 transition hover:border-indigo-400 hover:text-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
    >
      <span aria-hidden="true" className="relative block h-3 w-3 leading-none">
        <span className={`absolute inset-0 flex items-center justify-center transition-all duration-200 ${open ? 'rotate-90 scale-75 opacity-0' : 'rotate-0 scale-100 opacity-100'}`}>i</span>
        <span className={`absolute inset-0 flex items-center justify-center transition-all duration-200 ${open ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-75 opacity-0'}`}>×</span>
      </span>
    </button>
    {open && <div id={panelId} role="dialog" aria-label={`Why “${story.title}” matters`} className="absolute right-0 top-8 z-20 w-64 rounded-xl border border-slate-200 bg-white p-3.5 text-left shadow-xl">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-700">Why this matters</p>
      <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{story.value}</p>
    </div>}
  </div>;
}
export function StoryMap({ stories: initialStories, slices }: { stories: Story[]; slices: Slice[] }) {
  const [view, setView] = useState({ step: 'all', sliceFilter: 'all', readyOnly: false, legacy: null as string | null, restored: false });
  const { step, sliceFilter, readyOnly, legacy, restored } = view;
  const [stories, setStories] = useState(initialStories);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCell, setOverCell] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- Adopt regenerated Markdown content when local dev rebuilds it after a saved move.
  useEffect(() => { setStories(initialStories); }, [initialStories]);
  const setStep = (step: string) => setView(previous => ({ ...previous, step }));
  const setSliceFilter = (sliceFilter: string) => setView(previous => ({ ...previous, sliceFilter }));
  const setReadyOnly = (readyOnly: boolean) => setView(previous => ({ ...previous, readyOnly }));
  useEffect(() => {
    const next = { step: 'all', sliceFilter: 'all', readyOnly: false, legacy: null as string | null, restored: true };
    try { next.legacy = localStorage.getItem('catalog-forge-storymap-v1'); } catch { /* Storage is optional. */ }
    try {
      const saved = JSON.parse(localStorage.getItem('catalog-forge-storymap-view-v2') || '{}');
      if (saved.step === 'all' || steps.some(item => item.id === saved.step)) next.step = saved.step;
      if (saved.slice === 'all' || slices.some(item => item.id === saved.slice)) next.sliceFilter = saved.slice;
      next.readyOnly = saved.readyOnly === true;
    } catch { /* Invalid preferences never replace repository content. */ }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Restore browser-only preferences after hydration; shared story data is never restored from storage.
    setView(next);
  }, [slices]);
  useEffect(() => {
    if (restored) try { localStorage.setItem('catalog-forge-storymap-view-v2', JSON.stringify({ step, slice: sliceFilter, readyOnly })); } catch { /* Optional preferences. */ }
  }, [step, sliceFilter, readyOnly, restored]);
  const shownSteps = steps.filter(item => step === 'all' || item.id === step);
  const shownSlices = slices.filter(item => sliceFilter === 'all' || item.id === sliceFilter);
  const visibleStories = stories.filter(item => (step === 'all' || item.step === step) && (sliceFilter === 'all' || item.slice === sliceFilter) && (!readyOnly || isReady(item, stories)));
  const columns = { gridTemplateColumns: `200px repeat(${shownSteps.length}, minmax(230px, 1fr))` };
  async function moveStory(storyId: string, sliceId: string, stepId: string) {
    const current = stories.find(item => item.id === storyId);
    if (!current || (current.slice === sliceId && current.step === stepId)) return;
    const previous = stories;
    setStories(list => list.map(item => item.id === storyId ? { ...item, slice: sliceId, step: stepId } : item));
    setSavingId(storyId);
    setNotice(null);
    try {
      const response = await fetch('/api/story-map/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: storyId, slice: sliceId, step: stepId }),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: unknown; path?: unknown };
      if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : `Move failed (${response.status})`);
      const targetSlice = slices.find(item => item.id === sliceId);
      const stepTitle = steps.find(item => item.id === stepId)?.title ?? stepId;
      setNotice({ kind: 'ok', text: `Moved “${current.title}” to ${targetSlice?.title ?? sliceId} · ${stepTitle} — saved to ${typeof result.path === 'string' ? result.path : 'Markdown'}.` });
    } catch (error) {
      setStories(previous);
      setNotice({ kind: 'error', text: `Could not save the move: ${(error as Error).message}` });
    } finally {
      setSavingId(null);
    }
  }
  // Split header/body scroll sync: the journey header lives outside the body's
  // horizontal scroll container so it can stick to the page scroll. The body's
  // horizontal scroll position is mirrored onto the header (overflow-x-hidden
  // remains programmatically scrollable). Offset matches the sticky site header.
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const bodyScrollRef = useRef<HTMLDivElement>(null);
  const syncHeaderScroll = () => {
    if (headerScrollRef.current && bodyScrollRef.current) {
      headerScrollRef.current.scrollLeft = bodyScrollRef.current.scrollLeft;
    }
  };
  useEffect(() => {
    if (headerScrollRef.current) headerScrollRef.current.scrollLeft = 0;
    if (bodyScrollRef.current) bodyScrollRef.current.scrollLeft = 0;
  }, [step, sliceFilter, shownSteps.length]);
  const doneCount = stories.filter(s => s.status === 'done').length;
  const readyCount = stories.filter(s => isReady(s, stories)).length;
  return <div className="min-h-screen bg-[#f6f9fc] text-slate-900 antialiased">
    <header className="sticky top-0 z-30 border-b border-slate-900/10 bg-white/80 backdrop-blur-md"><div className="mx-auto flex h-14 w-full max-w-[1800px] items-center gap-3 px-5">
      <Link href="/" className="text-sm font-semibold text-slate-600 transition hover:text-slate-950"><span aria-hidden>←</span> Catalog Forge</Link><span className="h-4 w-px bg-slate-200" /><h1 className="text-sm font-semibold text-slate-950">Story map</h1>
      <span className="hidden items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-800 ring-1 ring-inset ring-amber-600/20 sm:inline-flex"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />Internal · dev only</span>
      <Link className="ml-auto rounded-lg bg-slate-950 px-3.5 py-1.5 text-sm font-semibold text-white transition hover:bg-slate-800" href="/editor">Open editor</Link>
    </div></header>
    <div className="relative overflow-hidden bg-slate-950 text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(600px 280px at 15% -10%, rgba(99,91,255,0.55), transparent 60%), radial-gradient(500px 260px at 85% 0%, rgba(0,212,255,0.35), transparent 60%)",
        }}
      />
      <div className="relative mx-auto flex w-full max-w-[1800px] flex-wrap items-end justify-between gap-4 px-5 pb-8 pt-8">
        <div><p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300">Plan → specify → implement</p><h2 className="mt-2 text-3xl font-bold tracking-tight">Catalog delivery, one slice at a time</h2><p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300">Explore the journey, open a story’s implementation spec, and hand a ready story to an agent. Shared scope and status come from the repository.</p></div>
        <div className="flex gap-2.5">{[[doneCount, 'done'], [readyCount, 'ready to assign']].map(([v, l]) => <div key={l as string} className="flex items-center gap-2 rounded-xl bg-white/10 px-3.5 py-2 ring-1 ring-inset ring-white/15 backdrop-blur"><span className="text-lg font-bold tabular-nums">{v}</span><span className="text-[11px] font-medium uppercase tracking-wider text-slate-300">{l}</span></div>)}</div>
      </div>
    </div>
    <main className="mx-auto max-w-[1800px] space-y-5 p-5">
      {legacy && <details className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm shadow-sm"><summary className="cursor-pointer font-semibold text-amber-900">Previous browser map available</summary><p className="my-2 text-amber-800">Local card edits no longer override the shared plan. Export them to reconcile any differences with the Markdown files.</p><button className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-900 transition hover:bg-amber-100" onClick={() => {
        const url = URL.createObjectURL(new Blob([legacy], { type: 'application/json' }));
        const link = document.createElement('a'); link.href = url; link.download = 'previous-story-map.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      }}>Export previous browser map</button></details>}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl border border-slate-900/[0.07] bg-white p-4 text-sm shadow-[0_1px_2px_rgba(16,24,40,0.05)]">
        <label className="flex items-center gap-2 font-medium text-slate-600">Journey step<select value={step} onChange={e => setStep(e.target.value)} className="max-w-56 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-800 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"><option value="all">All steps</option>{steps.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select></label>
        <label className="flex items-center gap-2 font-medium text-slate-600">Slice<select value={sliceFilter} onChange={e => setSliceFilter(e.target.value)} className="max-w-64 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-800 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"><option value="all">All slices</option>{slices.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select></label>
        <label className="flex cursor-pointer items-center gap-2 font-medium text-slate-600"><input type="checkbox" checked={readyOnly} onChange={e => setReadyOnly(e.target.checked)} className="h-4 w-4 rounded accent-indigo-600" />Ready to assign</label>
        <button className="text-xs font-medium text-slate-400 underline underline-offset-4 transition hover:text-slate-700" onClick={() => { setStep('all'); setSliceFilter('all'); setReadyOnly(false); }}>Clear filters</button>
        <span role="status" className="ml-auto rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">{visibleStories.length} stories shown</span>
      </div>
      {notice && <div role={notice.kind === 'error' ? 'alert' : 'status'} className={`flex items-start justify-between gap-3 rounded-2xl border p-4 text-sm shadow-sm ${notice.kind === 'error' ? 'border-rose-200 bg-rose-50 text-rose-900' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`}><p>{notice.text}</p><button type="button" onClick={() => setNotice(null)} aria-label="Dismiss notice" className="rounded px-1 font-semibold leading-none hover:opacity-70">×</button></div>}
      {!visibleStories.length ? <p className="rounded-2xl border border-slate-900/[0.07] bg-white p-10 text-center text-sm text-slate-500 shadow-sm">No stories match these filters. Clear filters to see the full map.</p> : <div aria-label="Story map by slice and journey step">
        <div ref={headerScrollRef} className="sticky top-[57px] z-20 overflow-x-hidden rounded-t-2xl border border-b-0 border-slate-900/10 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.05)]">
          <div className="grid" style={columns}><div className="sticky left-0 z-30 border-b border-r border-slate-900/10 bg-slate-50 p-4 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Slices ↓ · Journey →</div>{shownSteps.map(s => <div key={s.id} className="border-b border-r border-slate-900/10 bg-slate-50/80 p-4"><h3 className="text-sm font-bold tracking-tight text-slate-900">{s.title}</h3><p className="mt-0.5 text-xs text-slate-400">{s.subtitle}</p></div>)}</div>
        </div>
        <div ref={bodyScrollRef} onScroll={syncHeaderScroll} className="overflow-x-auto rounded-b-2xl border border-t-0 border-slate-900/10 bg-white shadow-[0_8px_24px_-12px_rgba(16,24,40,0.12)]">
        {shownSlices.map(slice => <div key={slice.id} className="grid" style={columns}><div className={`sticky left-0 z-10 border-b border-r border-slate-900/10 p-4 ${tones[slice.tone]}`}>
          <h3 className="text-sm font-bold tracking-tight text-slate-900">{slice.title}</h3><p className="mt-1.5 text-xs leading-relaxed text-slate-500">{slice.description}</p>
          {(() => { const total = stories.filter(s => s.slice === slice.id).length; const done = stories.filter(s => s.slice === slice.id && s.status === 'done').length; const pct = total ? Math.round((done / total) * 100) : 0; return <div className="my-3"><div className="flex items-center justify-between text-[11px] font-semibold text-slate-500"><span>{done}/{total} done</span><span className="tabular-nums">{pct}%</span></div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-900/10"><div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all" style={{ width: `${pct}%` }} /></div></div>; })()}
          <Link href={sliceUrl(slice)} className="text-xs font-semibold text-indigo-700 underline-offset-4 hover:text-indigo-900 hover:underline">Read slice spec →</Link><Link href={notesUrl(slice)} className="mt-2 block text-xs font-semibold text-indigo-700 underline-offset-4 hover:text-indigo-900 hover:underline">Implementation notes →</Link></div>
          {shownSteps.map(s => {
            const cellKey = `${slice.id}:${s.id}`;
            return <div
              key={s.id}
              onDragOver={event => { event.preventDefault(); if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'; setOverCell(cellKey); }}
              onDragLeave={() => setOverCell(key => key === cellKey ? null : key)}
              onDrop={event => {
                event.preventDefault();
                const id = event.dataTransfer?.getData('text/plain') || dragId;
                setOverCell(null);
                if (id) void moveStory(id, slice.id, s.id);
              }}
              className={`min-h-28 space-y-3 border-b border-r border-slate-900/[0.06] p-3 transition ${tones[slice.tone]} ${overCell === cellKey ? 'ring-2 ring-inset ring-indigo-500' : ''}`}
            >
            {visibleStories.filter(story => story.slice === slice.id && story.step === s.id).map(story => {
              const blocked = unmetDependencies(story, stories);
              return <article
                key={story.id}
                id={story.id}
                draggable
                title="Drag to move to another column or slice"
                onDragStart={event => { event.dataTransfer.setData('text/plain', story.id); event.dataTransfer.effectAllowed = 'move'; setDragId(story.id); }}
                onDragEnd={() => { setDragId(null); setOverCell(null); }}
                className={`relative scroll-mt-40 cursor-grab rounded-xl border border-slate-900/10 bg-white p-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.06)] transition hover:-translate-y-px hover:shadow-[0_8px_20px_-8px_rgba(99,91,255,0.35)] active:cursor-grabbing ${dragId === story.id ? 'opacity-50' : ''}`}
              >
                <div className="mb-2 flex items-start gap-2 text-[11px]"><span className={`rounded-md px-2 py-1 font-semibold ring-1 ring-inset ${story.status === 'done' ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' : isReady(story, stories) ? 'bg-indigo-50 text-indigo-700 ring-indigo-600/20' : 'bg-slate-100 text-slate-600 ring-slate-500/10'}`}>{statusLabels[story.status]}</span><span className="py-1 font-medium text-slate-400">{story.effort}</span><StoryValue story={story} /></div>
                <h4 className="text-sm font-bold leading-snug tracking-tight text-slate-900">{story.title}</h4><p className="mt-1.5 text-xs leading-relaxed text-slate-500">{story.description}</p>
                {savingId === story.id && <p role="status" className="mt-2 text-[11px] font-semibold text-indigo-600">Saving move…</p>}
                {story.acceptance.length > 0 && <details className="mt-3 text-xs"><summary className="cursor-pointer font-semibold text-slate-600 hover:text-slate-900">Acceptance criteria ({story.acceptance.length})</summary><ul className="mt-2 list-disc space-y-1.5 pl-4 text-slate-500">{story.acceptance.map(a => <li key={a}>{a}</li>)}</ul></details>}
                {story.implementation === 'outline' && <p className="mt-3 inline-block rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-500">Spec outline · refine before assigning</p>}
                {blocked.length > 0 && <div className="mt-3 rounded-lg border border-amber-200/70 bg-amber-50 p-2.5 text-xs text-amber-800"><p className="font-semibold">Waiting on {blocked.length} {blocked.length === 1 ? 'story' : 'stories'}</p>{blocked.map(id => { const dependency = stories.find(item => item.id === id)!; return <Link key={id} href={storyUrl(dependency)} className="mt-1 block underline underline-offset-2 hover:text-amber-950">{dependency.title}</Link>; })}</div>}
                <Link href={storyUrl(story)} className="mt-3.5 inline-block text-xs font-bold text-indigo-700 underline-offset-4 hover:text-indigo-900 hover:underline">View implementation spec →</Link>
              </article>;
            })}
            </div>;
          })}
        </div>)}
        </div>
      </div>}
      <p className="text-xs leading-relaxed text-slate-400">Drag a card to another column or slice to move it — moves save to the story Markdown in local dev. Edit story Markdown directly to change anything else. Only your filters are stored in this browser.</p>
    </main>
  </div>;
}
