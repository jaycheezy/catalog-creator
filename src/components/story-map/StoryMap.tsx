'use client';
import { useEffect, useRef, useState, type DragEvent } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import steps from '@/story-map/steps.json';
import { isReady, statusLabels, storyUrl, sliceUrl, notesUrl, unmetDependencies, type Slice, type Story, type StoryStatus } from '@/story-map/model';

const tones = { green: 'bg-emerald-50/70 border-emerald-100', blue: 'bg-sky-50/70 border-sky-100', violet: 'bg-indigo-50/70 border-indigo-100', amber: 'bg-amber-50/70 border-amber-100', zinc: 'bg-slate-100/70 border-slate-200' };
const STATUS_ORDER: StoryStatus[] = ['proposed', 'ready', 'in-progress', 'in-review', 'done', 'wont-do'];
const STATUS_DOT: Record<StoryStatus, string> = {
  proposed: 'bg-slate-400',
  ready: 'bg-indigo-500',
  'in-progress': 'bg-amber-500',
  'in-review': 'bg-sky-500',
  done: 'bg-emerald-500',
  'wont-do': 'bg-white ring-1 ring-inset ring-slate-400',
};
const CARD_VARIANTS = {
  studio: 'Studio',
  ribbon: 'Ribbon',
  compact: 'Compact',
} as const;
type CardVariant = keyof typeof CARD_VARIANTS;
const CARD_VARIANT_IDS = Object.keys(CARD_VARIANTS) as CardVariant[];
function statusRail(story: Story, stories: Story[]) {
  if (story.status === 'done') return 'border-l-emerald-400';
  if (story.status === 'wont-do') return 'border-l-slate-300';
  if (isReady(story, stories)) return 'border-l-indigo-500';
  if (story.status === 'in-progress') return 'border-l-amber-400';
  if (story.status === 'in-review') return 'border-l-sky-400';
  return 'border-l-slate-300';
}
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
function StoryStatusMenu({ story, stories, saving, onSelect }: { story: Story; stories: Story[]; saving: boolean; onSelect: (status: StoryStatus) => void }) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = `status-${story.id}`;
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { close(); buttonRef.current?.focus(); }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open ]);
  const pill = story.status === 'done'
    ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
    : isReady(story, stories)
      ? 'bg-indigo-50 text-indigo-700 ring-indigo-600/20'
      : 'bg-slate-100 text-slate-600 ring-slate-500/10';
  return <>
    <button
      ref={buttonRef}
      type="button"
      aria-haspopup="menu"
      aria-expanded={open}
      aria-controls={menuId}
      title="Change status"
      disabled={saving}
      onClick={() => {
        if (open) { setOpen(false); return; }
        const rect = buttonRef.current?.getBoundingClientRect();
        setAnchor(rect ? { top: rect.bottom + 6, left: Math.max(8, Math.min(rect.left, window.innerWidth - 224)) } : null);
        setOpen(true);
      }}
      className={`flex items-center gap-1.5 rounded-md px-2 py-1 font-semibold ring-1 ring-inset transition hover:brightness-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-wait disabled:opacity-60 ${pill} ${story.status === 'wont-do' ? 'line-through decoration-slate-400' : ''}`}
    >
      {statusLabels[story.status]}
      <svg viewBox="0 0 12 12" aria-hidden className={`h-3 w-3 opacity-60 transition-transform ${open ? 'rotate-180' : ''}`} fill="none"><path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>
    {open && anchor && typeof document !== 'undefined' && createPortal(<div ref={menuRef} id={menuId} role="menu" aria-label={`Change status of “${story.title}”`} style={{ top: anchor.top, left: anchor.left }} className="fixed z-50 w-52 rounded-xl border border-slate-200 bg-white p-1.5 text-left shadow-xl">
      <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Set status</p>
      {STATUS_ORDER.map(value => {
        const disabledReason = value === 'ready' && story.implementation === 'outline' ? 'Needs a specified implementation first' : null;
        return <button
          key={value}
          type="button"
          role="menuitem"
          disabled={disabledReason !== null}
          title={disabledReason ?? statusLabels[value]}
          onClick={() => { setOpen(false); if (value !== story.status) onSelect(value); }}
          className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent ${value === story.status ? 'bg-indigo-50/60' : ''}`}
        >
          <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[value]}`} />
          <span className="flex-1 text-slate-700">{statusLabels[value]}</span>
          {value === story.status && <svg viewBox="0 0 12 12" aria-hidden className="h-3.5 w-3.5 text-indigo-600" fill="none"><path d="M2.5 6.2 5 8.5 9.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
        </button>;
      })}
    </div>, document.body)}
  </>;
}
export function StoryCard({ story, stories, variant, dimmed, saving, savingKind, onDragStart, onDragEnd, onStatusSelect }: { story: Story;
  stories: Story[];
  variant: CardVariant;
  dimmed: boolean;
  saving: boolean;
  savingKind: 'move' | 'status' | null;
  onDragStart: (event: DragEvent) => void;
  onDragEnd: () => void;
  onStatusSelect: (status: StoryStatus) => void;
}) {
  const blocked = unmetDependencies(story, stories);
  const compact = variant === 'compact';
  return <article
    id={story.id}
    draggable
    title="Drag to move to another column or slice"
    onDragStart={onDragStart}
    onDragEnd={onDragEnd}
    className={`relative scroll-mt-40 cursor-grab bg-white transition active:cursor-grabbing ${dimmed ? 'opacity-50' : ''} ${variant === 'ribbon'
      ? `rounded-xl border border-slate-900/10 border-l-4 ${statusRail(story, stories)} p-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.06)] hover:-translate-y-px hover:shadow-[0_8px_20px_-8px_rgba(99,91,255,0.35)]`
      : compact
        ? 'rounded-lg border border-slate-900/10 p-2.5 shadow-[0_1px_2px_rgba(16,24,40,0.06)] hover:border-indigo-200 hover:shadow-[0_6px_16px_-8px_rgba(99,91,255,0.4)]'
        : 'rounded-xl border border-slate-900/10 p-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.06)] hover:-translate-y-px hover:shadow-[0_8px_20px_-8px_rgba(99,91,255,0.35)]'}`}
  >
    <div className={`flex items-start gap-2 ${compact ? 'mb-1.5 text-[10px]' : 'mb-2 text-[11px]'}`}><StoryStatusMenu story={story} stories={stories} saving={saving} onSelect={onStatusSelect} /><span className="py-1 font-medium text-slate-400">{story.effort}</span><StoryValue story={story} /></div>
    <h4 className={`font-bold leading-snug tracking-tight text-slate-900 ${compact ? 'text-[13px]' : variant === 'ribbon' ? 'text-[15px]' : 'text-sm'}`}>{story.title}</h4>
    <p className={`mt-1.5 leading-relaxed text-slate-500 ${compact ? 'line-clamp-2 text-[11px]' : 'text-xs'}`}>{story.description}</p>
    {saving && <p role="status" className="mt-2 text-[11px] font-semibold text-indigo-600">{savingKind === 'status' ? 'Saving status…' : 'Saving move…'}</p>}
    {story.acceptance.length > 0 && <details className={`group ${compact ? 'mt-2' : 'mt-3'}`}>
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 ring-1 ring-inset ring-slate-900/5 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-indigo-600 [&::-webkit-details-marker]:hidden">
        <svg viewBox="0 0 12 12" aria-hidden className="h-3 w-3 shrink-0 text-slate-400 transition-transform group-open:rotate-90" fill="none"><path d="M4.5 3 7.5 6 4.5 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        Acceptance criteria
        <span className="ml-auto rounded-full bg-white px-1.5 py-px text-[10px] font-bold tabular-nums text-slate-500 ring-1 ring-inset ring-slate-900/10">{story.acceptance.length}</span>
      </summary>
      <ul className="mt-1.5 space-y-1.5 px-1 pb-0.5">{story.acceptance.map(a => <li key={a} className="flex gap-2 text-[11px] leading-relaxed text-slate-500"><span aria-hidden className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-slate-300" /><span>{a}</span></li>)}</ul>
    </details>}
    {story.implementation === 'outline' && <p className="mt-3 inline-block rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-500">Spec outline · refine before assigning</p>}
    {blocked.length > 0 && <div className={`rounded-lg border border-amber-200/70 bg-amber-50 text-amber-800 ${compact ? 'mt-2 p-2 text-[11px]' : 'mt-3 p-2.5 text-xs'}`}><p className="font-semibold">Waiting on {blocked.length} {blocked.length === 1 ? 'story' : 'stories'}</p>{blocked.map(id => { const dependency = stories.find(item => item.id === id)!; return <Link key={id} href={storyUrl(dependency)} className="mt-1 block underline underline-offset-2 hover:text-amber-950">{dependency.title}</Link>; })}</div>}
    {variant === 'ribbon'
      ? <Link href={storyUrl(story)} className="mt-3 flex items-center justify-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100">View implementation spec <span aria-hidden>→</span></Link>
      : <Link href={storyUrl(story)} className={`inline-block font-bold text-indigo-700 underline-offset-4 hover:text-indigo-900 hover:underline ${compact ? 'mt-2.5 text-[11px]' : 'mt-3.5 text-xs'}`}>View implementation spec →</Link>}
  </article>;
}
export function StoryMap({ stories: initialStories, slices }: { stories: Story[]; slices: Slice[] }) {
  const [view, setView] = useState({ step: 'all', sliceFilter: 'all', readyOnly: false, cardStyle: 'studio' as CardVariant, restored: false });
  const { step, sliceFilter, readyOnly, cardStyle, restored } = view;
  const [stories, setStories] = useState(initialStories);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCell, setOverCell] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savingKind, setSavingKind] = useState<'move' | 'status' | null>(null);
  const [collapsedOverrides, setCollapsedOverrides] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- Adopt regenerated Markdown content when local dev rebuilds it after a saved move.
  useEffect(() => { setStories(initialStories); }, [initialStories]);
  const setStep = (step: string) => setView(previous => ({ ...previous, step }));
  const setSliceFilter = (sliceFilter: string) => setView(previous => ({ ...previous, sliceFilter }));
  const setReadyOnly = (readyOnly: boolean) => setView(previous => ({ ...previous, readyOnly }));
  const setCardStyle = (cardStyle: CardVariant) => setView(previous => ({ ...previous, cardStyle }));
  useEffect(() => {
    const next = { step: 'all', sliceFilter: 'all', readyOnly: false, cardStyle: 'studio' as CardVariant, restored: true };
    try {
      const saved = JSON.parse(localStorage.getItem('catalog-forge-storymap-view-v2') || '{}');
      if (saved.step === 'all' || steps.some(item => item.id === saved.step)) next.step = saved.step;
      if (saved.slice === 'all' || slices.some(item => item.id === saved.slice)) next.sliceFilter = saved.slice;
      next.readyOnly = saved.readyOnly === true;
      if (CARD_VARIANT_IDS.includes(saved.cardStyle)) next.cardStyle = saved.cardStyle;
    } catch { /* Invalid preferences never replace repository content. */ }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Restore browser-only preferences after hydration; shared story data is never restored from storage.
    setView(next);
  }, [slices]);
  useEffect(() => {
    if (restored) try { localStorage.setItem('catalog-forge-storymap-view-v2', JSON.stringify({ step, slice: sliceFilter, readyOnly, cardStyle })); } catch { /* Optional preferences. */ }
  }, [step, sliceFilter, readyOnly, cardStyle, restored]);
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
    setSavingKind('move');
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
      setSavingKind(null);
    }
  }
  async function changeStatus(storyId: string, status: StoryStatus) {
    const current = stories.find(item => item.id === storyId);
    if (!current || current.status === status) return;
    const previous = stories;
    setStories(list => list.map(item => item.id === storyId ? { ...item, status } : item));
    setSavingId(storyId);
    setSavingKind('status');
    setNotice(null);
    try {
      const response = await fetch('/api/story-map/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: storyId, status }),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: unknown; path?: unknown };
      if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : `Status change failed (${response.status})`);
      setNotice({ kind: 'ok', text: `Set “${current.title}” to ${statusLabels[status]} — saved to ${typeof result.path === 'string' ? result.path : 'Markdown'}.` });
    } catch (error) {
      setStories(previous);
      setNotice({ kind: 'error', text: `Could not save the status: ${(error as Error).message}` });
    } finally {
      setSavingId(null);
      setSavingKind(null);
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
  const isTerminalStatus = (status: StoryStatus) => status === 'done' || status === 'wont-do';
  const sliceTerminalCount = (sliceId: string) => stories.filter(s => s.slice === sliceId && isTerminalStatus(s.status)).length;
  const sliceTotalCount = (sliceId: string) => stories.filter(s => s.slice === sliceId).length;
  const defaultCollapsed = (sliceId: string) => {
    const total = sliceTotalCount(sliceId);
    return total > 0 && sliceTerminalCount(sliceId) === total;
  };
  const isCollapsed = (sliceId: string) => collapsedOverrides[sliceId] ?? defaultCollapsed(sliceId);
  return <div className="min-h-screen bg-[#f6f9fc] text-slate-900 antialiased">
    <header className="sticky top-0 z-30 border-b border-slate-900/10 bg-white/80 backdrop-blur-md"><div className="mx-auto flex h-14 w-full max-w-[1800px] items-center gap-3 px-5">
      <Link href="/" className="text-sm font-semibold text-slate-600 transition hover:text-slate-950"><span aria-hidden>←</span> Catalog Forge</Link><span className="h-4 w-px bg-slate-200" /><h1 className="text-sm font-semibold text-slate-950">Story map</h1>
      <span className="hidden items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-800 ring-1 ring-inset ring-amber-600/20 sm:inline-flex"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />Internal · dev only</span>
      <Link className="ml-auto rounded-lg bg-slate-950 px-3.5 py-1.5 text-sm font-semibold text-white transition hover:bg-slate-800" href="/editor">Open editor</Link>
    </div></header>
    <main className="mx-auto max-w-[1800px] space-y-5 p-5">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl border border-slate-900/[0.07] bg-white p-4 text-sm shadow-[0_1px_2px_rgba(16,24,40,0.05)]">
        <label className="flex items-center gap-2 font-medium text-slate-600">Journey step<select value={step} onChange={e => setStep(e.target.value)} className="max-w-56 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-800 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"><option value="all">All steps</option>{steps.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select></label>
        <label className="flex items-center gap-2 font-medium text-slate-600">Slice<select value={sliceFilter} onChange={e => setSliceFilter(e.target.value)} className="max-w-64 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-800 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"><option value="all">All slices</option>{slices.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select></label>
        <label className="flex cursor-pointer items-center gap-2 font-medium text-slate-600"><input type="checkbox" checked={readyOnly} onChange={e => setReadyOnly(e.target.checked)} className="h-4 w-4 rounded accent-indigo-600" />Ready to assign</label>
        <div className="flex items-center gap-2 font-medium text-slate-600">Cards<span role="group" aria-label="Card style" className="flex items-center gap-0.5 rounded-lg bg-slate-100 p-1">{CARD_VARIANT_IDS.map(variant => <button
          key={variant}
          type="button"
          aria-pressed={cardStyle === variant}
          title={`${CARD_VARIANTS[variant]} cards`}
          onClick={() => setCardStyle(variant)}
          className={`rounded-md px-2.5 py-1 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-indigo-600 ${cardStyle === variant ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-900/10' : 'text-slate-500 hover:text-slate-800'}`}
        >{CARD_VARIANTS[variant]}</button>)}</span></div>
        <button className="text-xs font-medium text-slate-400 underline underline-offset-4 transition hover:text-slate-700" onClick={() => { setStep('all'); setSliceFilter('all'); setReadyOnly(false); }}>Clear filters</button>
        <span role="status" className="ml-auto rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">{visibleStories.length} stories shown</span>
      </div>
      {notice && <div role={notice.kind === 'error' ? 'alert' : 'status'} className={`flex items-start justify-between gap-3 rounded-2xl border p-4 text-sm shadow-sm ${notice.kind === 'error' ? 'border-rose-200 bg-rose-50 text-rose-900' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`}><p>{notice.text}</p><button type="button" onClick={() => setNotice(null)} aria-label="Dismiss notice" className="rounded px-1 font-semibold leading-none hover:opacity-70">×</button></div>}
      {!visibleStories.length ? <p className="rounded-2xl border border-slate-900/[0.07] bg-white p-10 text-center text-sm text-slate-500 shadow-sm">No stories match these filters. Clear filters to see the full map.</p> : <div aria-label="Story map by slice and journey step">
        <div ref={headerScrollRef} className="sticky top-[57px] z-20 overflow-x-hidden rounded-t-2xl border border-b-0 border-slate-900/10 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.05)]">
          <div className="grid" style={columns}><div className="sticky left-0 z-30 border-b border-r border-slate-900/10 bg-slate-50 p-4 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Slices ↓ · Journey →</div>{shownSteps.map(s => <div key={s.id} className="border-b border-r border-slate-900/10 bg-slate-50/80 p-4"><h3 className="text-sm font-bold tracking-tight text-slate-900">{s.title}</h3><p className="mt-0.5 text-xs text-slate-400">{s.subtitle}</p></div>)}</div>
        </div>
        <div ref={bodyScrollRef} onScroll={syncHeaderScroll} className="overflow-x-auto rounded-b-2xl border border-t-0 border-slate-900/10 bg-white shadow-[0_8px_24px_-12px_rgba(16,24,40,0.12)]">
        {shownSlices.map(slice => {
          if (isCollapsed(slice.id)) return <button
            key={slice.id}
            type="button"
            aria-expanded={false}
            title={`Expand ${slice.title}`}
            onClick={() => setCollapsedOverrides(previous => ({ ...previous, [slice.id]: false }))}
            className="block w-full border-b border-slate-900/10 bg-slate-50/70 text-left transition hover:bg-slate-100"
          >
            <span className="sticky left-0 inline-flex w-max max-w-full items-center gap-3 px-4 py-3">
              <svg viewBox="0 0 12 12" aria-hidden className="h-3.5 w-3.5 shrink-0 text-slate-400" fill="none"><path d="M4.5 3 7.5 6 4.5 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              <span className="truncate text-sm font-bold tracking-tight text-slate-700">{slice.title}</span>
              <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">{sliceTerminalCount(slice.id)}/{sliceTotalCount(slice.id)} done or won&apos;t do</span>
              <span className="shrink-0 text-xs font-bold text-indigo-700">Expand →</span>
            </span>
          </button>;
          return <div key={slice.id} className="grid" style={columns}><div className={`sticky left-0 z-10 border-b border-r border-slate-900/10 p-4 ${tones[slice.tone]}`}>
          <div className="flex items-start justify-between gap-2"><h3 className="text-sm font-bold tracking-tight text-slate-900">{slice.title}</h3><button
            type="button"
            aria-expanded={true}
            aria-label={`Collapse ${slice.title}`}
            title="Collapse slice"
            onClick={() => setCollapsedOverrides(previous => ({ ...previous, [slice.id]: true }))}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-900/5 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            <svg viewBox="0 0 12 12" aria-hidden className="h-3.5 w-3.5" fill="none"><path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button></div><p className="mt-1.5 text-xs leading-relaxed text-slate-500">{slice.description}</p>
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
            {visibleStories.filter(story => story.slice === slice.id && story.step === s.id).map(story => <StoryCard
                key={story.id}
                story={story}
                stories={stories}
                variant={cardStyle}
                dimmed={dragId === story.id}
                saving={savingId === story.id}
                savingKind={savingKind}
                onDragStart={event => { event.dataTransfer.setData('text/plain', story.id); event.dataTransfer.effectAllowed = 'move'; setDragId(story.id); }}
                onDragEnd={() => { setDragId(null); setOverCell(null); }}
                onStatusSelect={status => void changeStatus(story.id, status)}
              />)}
            </div>;
          })}
        </div>; })}
        </div>
      </div>}
      <p className="text-xs leading-relaxed text-slate-400">Drag a card to another column or slice to move it — moves save to the story Markdown in local dev. Click a status pill to change it — status changes save the same way. Slices where every story is done or won&apos;t do start collapsed; click the slice bar to expand it. Edit story Markdown directly to change anything else. Only your filters are stored in this browser.</p>
    </main>
  </div>;
}
