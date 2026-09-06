'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import steps from '@/story-map/steps.json';
import { isReady, statusLabels, storyUrl, sliceUrl, notesUrl, unmetDependencies, type Slice, type Story } from '@/story-map/model';

const tones = { green: 'bg-green-50 border-green-200', blue: 'bg-blue-50 border-blue-200', violet: 'bg-violet-50 border-violet-200', amber: 'bg-amber-50 border-amber-200', zinc: 'bg-zinc-50 border-zinc-200' };
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
      className="flex h-6 w-6 items-center justify-center rounded-full border border-zinc-300 bg-white text-xs font-semibold text-zinc-600 hover:border-violet-400 hover:text-violet-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600"
    >
      <span aria-hidden="true" className="relative block h-3 w-3 leading-none">
        <span className={`absolute inset-0 flex items-center justify-center transition-all duration-200 ${open ? 'rotate-90 scale-75 opacity-0' : 'rotate-0 scale-100 opacity-100'}`}>i</span>
        <span className={`absolute inset-0 flex items-center justify-center transition-all duration-200 ${open ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-75 opacity-0'}`}>×</span>
      </span>
    </button>
    {open && <div id={panelId} role="dialog" aria-label={`Why “${story.title}” matters`} className="absolute right-0 top-8 z-20 w-64 rounded-lg border border-zinc-200 bg-white p-3 text-left shadow-lg">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-violet-700">Why this matters</p>
      <p className="mt-1.5 text-xs leading-relaxed text-zinc-700">{story.value}</p>
    </div>}
  </div>;
}
export function StoryMap({ stories, slices }: { stories: Story[]; slices: Slice[] }) {
  const [view, setView] = useState({ step: 'all', sliceFilter: 'all', readyOnly: false, legacy: null as string | null, restored: false });
  const { step, sliceFilter, readyOnly, legacy, restored } = view;
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
  const columns = { gridTemplateColumns: `190px repeat(${shownSteps.length}, minmax(220px, 1fr))` };
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
  return <div className="min-h-screen bg-zinc-50 text-zinc-900">
    <header className="sticky top-0 z-30 border-b bg-white"><div className="mx-auto flex max-w-[1800px] flex-wrap items-center gap-4 px-5 py-5">
      <Link href="/" className="font-semibold">Catalog Forge</Link><span className="text-zinc-300">/</span><h1 className="font-medium">Story map</h1>
      <Link className="ml-auto text-sm underline underline-offset-4" href="/editor">Open editor</Link>
    </div></header>
    <main className="mx-auto max-w-[1800px] space-y-5 p-5">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-widest text-violet-700">Plan → specify → implement</p><h2 className="mt-2 text-2xl font-semibold">Catalog delivery, one slice at a time</h2><p className="mt-2 max-w-3xl text-sm text-zinc-600">Explore the journey, open a story’s implementation spec, and hand a ready story to an agent. Shared scope and status come from the repository.</p></div><p className="text-sm text-zinc-600">{stories.filter(s => s.status === 'done').length} done · {stories.filter(s => isReady(s, stories)).length} ready to assign</p></div>
      {legacy && <details className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm"><summary className="cursor-pointer font-medium">Previous browser map available</summary><p className="my-2 text-zinc-700">Local card edits no longer override the shared plan. Export them to reconcile any differences with the Markdown files.</p><button className="rounded border bg-white px-3 py-2 text-xs" onClick={() => {
        const url = URL.createObjectURL(new Blob([legacy], { type: 'application/json' }));
        const link = document.createElement('a'); link.href = url; link.download = 'previous-story-map.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      }}>Export previous browser map</button></details>}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border bg-white p-3 text-sm">
        <label className="flex items-center gap-2">Journey step<select value={step} onChange={e => setStep(e.target.value)} className="max-w-56 rounded border bg-white p-2"><option value="all">All steps</option>{steps.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select></label>
        <label className="flex items-center gap-2">Slice<select value={sliceFilter} onChange={e => setSliceFilter(e.target.value)} className="max-w-64 rounded border bg-white p-2"><option value="all">All slices</option>{slices.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select></label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={readyOnly} onChange={e => setReadyOnly(e.target.checked)} />Ready to assign</label>
        <button className="text-xs underline" onClick={() => { setStep('all'); setSliceFilter('all'); setReadyOnly(false); }}>Clear filters</button>
        <span role="status" className="ml-auto text-xs text-zinc-500">{visibleStories.length} stories shown</span>
      </div>
      {!visibleStories.length ? <p className="rounded-xl border bg-white p-8 text-center text-zinc-600">No stories match these filters. Clear filters to see the full map.</p> : <div aria-label="Story map by slice and journey step">
        <div ref={headerScrollRef} className="sticky top-[65px] z-20 overflow-x-hidden rounded-t-xl border border-b-0 bg-white">
          <div className="grid" style={columns}><div className="sticky left-0 z-30 border-b border-r bg-white p-4 text-xs font-medium">Slices ↓ · Journey →</div>{shownSteps.map(s => <div key={s.id} className="border-b border-r bg-white p-4"><h3 className="text-sm font-semibold">{s.title}</h3><p className="mt-1 text-xs text-zinc-500">{s.subtitle}</p></div>)}</div>
        </div>
        <div ref={bodyScrollRef} onScroll={syncHeaderScroll} className="overflow-x-auto rounded-b-xl border border-t-0 bg-white">
        {shownSlices.map(slice => <div key={slice.id} className="grid" style={columns}><div className={`sticky left-0 z-10 border-b border-r p-4 ${tones[slice.tone]}`}><h3 className="text-sm font-semibold">{slice.title}</h3><p className="mt-2 text-xs text-zinc-600">{slice.description}</p><p className="my-3 text-xs">{stories.filter(s => s.slice === slice.id && s.status === 'done').length}/{stories.filter(s => s.slice === slice.id).length} done</p><Link href={sliceUrl(slice)} className="text-xs font-medium underline underline-offset-4">Read slice spec →</Link><Link href={notesUrl(slice)} className="mt-3 block text-xs font-medium underline underline-offset-4">Implementation notes →</Link></div>
          {shownSteps.map(s => <div key={s.id} className={`space-y-3 border-b border-r p-3 ${tones[slice.tone]}`}>
            {visibleStories.filter(story => story.slice === slice.id && story.step === s.id).map(story => {
              const blocked = unmetDependencies(story, stories);
              return <article key={story.id} id={story.id} className="relative rounded-lg border border-zinc-200 bg-white p-3 shadow-sm">
                <div className="mb-2 flex items-start gap-2 text-[11px]"><span className={`rounded px-2 py-1 ${story.status === 'done' ? 'bg-green-100 text-green-800' : isReady(story, stories) ? 'bg-violet-100 text-violet-800' : 'bg-zinc-100 text-zinc-700'}`}>{statusLabels[story.status]}</span><span className="py-1 text-zinc-500">{story.effort}</span><StoryValue story={story} /></div>
                <h4 className="text-sm font-semibold leading-snug">{story.title}</h4><p className="mt-2 text-xs leading-relaxed text-zinc-600">{story.description}</p>
                {story.acceptance.length > 0 && <details className="mt-3 text-xs"><summary className="cursor-pointer font-medium text-zinc-700">Acceptance criteria ({story.acceptance.length})</summary><ul className="mt-2 list-disc space-y-2 pl-4 text-zinc-600">{story.acceptance.map(a => <li key={a}>{a}</li>)}</ul></details>}
                {story.implementation === 'outline' && <p className="mt-3 text-[11px] text-zinc-500">Spec outline · refine before assigning</p>}
                {blocked.length > 0 && <div className="mt-3 border-t pt-2 text-xs text-amber-800"><p className="font-medium">Waiting on {blocked.length} {blocked.length === 1 ? 'story' : 'stories'}</p>{blocked.map(id => { const dependency = stories.find(item => item.id === id)!; return <Link key={id} href={storyUrl(dependency)} className="mt-1 block underline">{dependency.title}</Link>; })}</div>}
                <Link href={storyUrl(story)} className="mt-4 inline-block text-xs font-semibold text-violet-800 underline underline-offset-4">View implementation spec →</Link>
              </article>;
            })}
          </div>)}
        </div>)}
        </div>
      </div>}
      <p className="text-xs text-zinc-500">Edit story Markdown to change shared scope, dependencies or status. Only your filters are stored in this browser.</p>
    </main>
  </div>;
}
