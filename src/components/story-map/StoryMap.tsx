'use client';
import { useEffect, useRef, useState, type DragEvent } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import steps from '@/story-map/steps.json';
import { isReady, statusLabels, storyUrl, sliceUrl, notesUrl, unmetDependencies, type Slice, type Story, type StoryStatus } from '@/story-map/model';

const TONE_BAR: Record<Slice['tone'], string> = { green: 'bg-emerald-400', blue: 'bg-sky-400', violet: 'bg-indigo-400', amber: 'bg-amber-400', zinc: 'bg-slate-300' };
const STATUS_ORDER: StoryStatus[] = ['proposed', 'ready', 'in-progress', 'in-review', 'done', 'wont-do'];
const STATUS_DOT: Record<StoryStatus, string> = {
  proposed: 'bg-slate-400',
  ready: 'bg-indigo-500',
  'in-progress': 'bg-amber-500',
  'in-review': 'bg-sky-500',
  done: 'bg-emerald-500',
  'wont-do': 'bg-white ring-1 ring-inset ring-slate-400',
};
function StorySummaryTip({ story }: { story: Story }) {
  return <span className="group/sum relative shrink-0">
    <button
      type="button"
      aria-label={`Show full summary for ${story.title}`}
      title="Hover for the full summary"
      className="flex h-5 w-5 items-center justify-center rounded-full border border-indigo-200 bg-indigo-50 text-[10px] font-bold text-indigo-500 transition hover:border-indigo-400 hover:text-indigo-800 focus-visible:outline-2 focus-visible:outline-indigo-600"
    >i</button>
    <span role="tooltip" className="absolute right-0 top-6 z-30 hidden w-64 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-xl group-hover/sum:block group-focus-within/sum:block">
      <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Full summary</span>
      <span className="mt-1 block text-xs leading-relaxed text-slate-600">{story.description}</span>
      {story.value && <span className="mt-1.5 block text-xs leading-relaxed text-slate-600"><span className="font-bold">Why: </span>{story.value}</span>}
    </span>
  </span>;
}
function SliceGrip({ sliceId, disabled, onDragStart, onDragEnd }: { sliceId: string; disabled: boolean; onDragStart: (sliceId: string) => void; onDragEnd: () => void }) {
  return <span
    draggable={!disabled}
    onDragStart={event => {
      event.dataTransfer.setData('application/x-slice-id', sliceId);
      event.dataTransfer.effectAllowed = 'move';
      onDragStart(sliceId);
    }}
    onDragEnd={onDragEnd}
    title={disabled ? 'Clear the slice filter to reorder slices' : 'Drag to reorder slices'}
    className={`flex h-5 w-4 shrink-0 items-center justify-center rounded transition ${disabled ? 'cursor-not-allowed opacity-30' : 'cursor-grab text-slate-300 hover:bg-slate-900/5 hover:text-slate-500 active:cursor-grabbing'}`}
  >
    <svg viewBox="0 0 10 12" aria-hidden className="h-3 w-2.5" fill="currentColor"><circle cx="2.5" cy="2.5" r="1.2" /><circle cx="7.5" cy="2.5" r="1.2" /><circle cx="2.5" cy="6" r="1.2" /><circle cx="7.5" cy="6" r="1.2" /><circle cx="2.5" cy="9.5" r="1.2" /><circle cx="7.5" cy="9.5" r="1.2" /></svg>
  </span>;
}
function StoryStatusMenu({ story, saving, onSelect }: { story: Story; saving: boolean; onSelect: (status: StoryStatus) => void }) {
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
      className={`flex items-center gap-1.5 rounded px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-wait disabled:opacity-60 ${story.status === 'wont-do' ? 'text-slate-400 line-through decoration-slate-400' : 'text-slate-500'}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[story.status]}`} />
      {statusLabels[story.status]}
      <svg viewBox="0 0 12 12" aria-hidden className={`h-2.5 w-2.5 opacity-60 transition-transform ${open ? 'rotate-180' : ''}`} fill="none"><path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
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
export function StoryCard({ story, stories, dimmed, saving, savingKind, onDragStart, onDragEnd, onStatusSelect }: { story: Story;
  stories: Story[];
  dimmed: boolean;
  saving: boolean;
  savingKind: 'move' | 'status' | null;
  onDragStart: (event: DragEvent) => void;
  onDragEnd: () => void;
  onStatusSelect: (status: StoryStatus) => void;
}) {
  const blocked = unmetDependencies(story, stories);
  return <article
    id={story.id}
    draggable
    title="Drag to move to another column or slice"
    onDragStart={onDragStart}
    onDragEnd={onDragEnd}
    className={`relative scroll-mt-40 cursor-grab rounded-lg border border-slate-900/10 bg-white p-2.5 shadow-[0_1px_2px_rgba(16,24,40,0.06)] transition hover:border-slate-400 active:cursor-grabbing ${dimmed ? 'opacity-50' : ''}`}
  >
    <div className="flex items-center gap-1.5 text-[10px] font-medium normal-case tracking-normal text-slate-400"><StoryStatusMenu story={story} saving={saving} onSelect={onStatusSelect} /><span className="ml-auto font-semibold">{story.effort}</span><StorySummaryTip story={story} /></div>
    <h4 className="mt-1 text-[13px] font-semibold leading-snug text-slate-900">{story.title}</h4>
    <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-500" title={story.description}>{story.description}</p>
    {story.value && <p className="mt-1.5 line-clamp-2 border-l-2 border-slate-200 pl-1.5 text-[11px] leading-snug text-slate-600"><span className="font-bold text-slate-500">Why: </span>{story.value}</p>}
    {saving && <p role="status" className="mt-2 text-[11px] font-semibold text-indigo-600">{savingKind === 'status' ? 'Saving status…' : 'Saving move…'}</p>}
    {story.acceptance.length > 0 && <details className="group mt-1.5 rounded-md bg-slate-50 ring-1 ring-inset ring-slate-900/5">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-1.5 py-1 text-[11px] font-semibold text-slate-500 transition hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-indigo-600 [&::-webkit-details-marker]:hidden">
        <svg viewBox="0 0 12 12" aria-hidden className="h-2.5 w-2.5 shrink-0 text-slate-400 transition-transform group-open:rotate-90" fill="none"><path d="M4.5 3 7.5 6 4.5 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        {story.acceptance.length} acceptance {story.acceptance.length === 1 ? 'criterion' : 'criteria'}
      </summary>
      <ul className="space-y-1 px-1.5 pb-1.5">{story.acceptance.map(a => <li key={a} className="flex gap-1.5 text-[11px] leading-snug text-slate-600"><span aria-hidden className="mt-px flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border border-slate-300 bg-white text-[9px] font-bold leading-none text-slate-400">✓</span><span>{a}</span></li>)}</ul>
    </details>}
    {blocked.length > 0 && <p className="mt-1.5 text-[11px] leading-relaxed text-amber-700"><span className="font-medium">⧗ Waiting on {blocked.length} — </span>{blocked.map((id, index) => { const dependency = stories.find(item => item.id === id)!; return <span key={id}>{index > 0 && ' · '}<Link href={storyUrl(dependency)} className="underline underline-offset-2 hover:text-amber-950">{dependency.title}</Link></span>; })}</p>}
    <div className="mt-1.5 flex items-center gap-2 border-t border-slate-100 pt-1.5 text-[11px]">
      <span className="font-mono text-[10px] text-slate-400">{story.id}</span>
      {story.implementation === 'outline' && <span className="rounded bg-slate-100 px-1.5 py-px text-[10px] font-bold text-slate-500">OUTLINE</span>}
      <Link href={storyUrl(story)} aria-label={`Open spec for ${story.title}`} className="ml-auto font-bold text-slate-600 hover:text-slate-950">→</Link>
    </div>
  </article>;
}
export function StoryMap({ stories: initialStories, slices }: { stories: Story[]; slices: Slice[] }) {
  const [view, setView] = useState({ step: 'all', sliceFilter: 'all', readyOnly: false, restored: false });
  const { step, sliceFilter, readyOnly, restored } = view;
  const [stories, setStories] = useState(initialStories);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCell, setOverCell] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savingKind, setSavingKind] = useState<'move' | 'status' | null>(null);
  const [collapsedOverrides, setCollapsedOverrides] = useState<Record<string, boolean>>({});
  const [dragSliceId, setDragSliceId] = useState<string | null>(null);
  const [sliceOver, setSliceOver] = useState<{ id: string; position: 'before' | 'after' } | null>(null);
  const [orderOverride, setOrderOverride] = useState<string[] | null>(null);
  const [reordering, setReordering] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- Adopt regenerated Markdown content when local dev rebuilds it after a saved move.
  useEffect(() => { setStories(initialStories); }, [initialStories]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- Adopt regenerated slice order after a saved reorder.
  useEffect(() => { setOrderOverride(null); }, [slices]);
  const setStep = (step: string) => setView(previous => ({ ...previous, step }));
  const setSliceFilter = (sliceFilter: string) => setView(previous => ({ ...previous, sliceFilter }));
  const setReadyOnly = (readyOnly: boolean) => setView(previous => ({ ...previous, readyOnly }));
  useEffect(() => {
    const next = { step: 'all', sliceFilter: 'all', readyOnly: false, restored: true };
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
  const isTerminalStatus = (status: StoryStatus) => status === 'done' || status === 'wont-do';
  const sliceTerminalCount = (sliceId: string) => stories.filter(s => s.slice === sliceId && isTerminalStatus(s.status)).length;
  const sliceTotalCount = (sliceId: string) => stories.filter(s => s.slice === sliceId).length;
  const isFinishedSlice = (sliceId: string) => {
    const total = sliceTotalCount(sliceId);
    return total > 0 && sliceTerminalCount(sliceId) === total;
  };
  const shownSteps = steps.filter(item => step === 'all' || item.id === step);
  const orderRank = (id: string, fallback: number) => {
    if (!orderOverride) return fallback;
    const index = orderOverride.indexOf(id);
    return index >= 0 ? index : fallback + orderOverride.length;
  };
  const shownSlices = slices
    .filter(item => sliceFilter === 'all' || item.id === sliceFilter)
    .sort((a, b) => Number(isFinishedSlice(b.id)) - Number(isFinishedSlice(a.id)) || orderRank(a.id, a.order) - orderRank(b.id, b.order) || a.id.localeCompare(b.id));
  const canReorderSlices = sliceFilter === 'all' && !reordering;
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
  async function reorderSlices(draggedId: string, targetId: string, position: 'before' | 'after') {
    const base = shownSlices.map(item => item.id);
    if (!base.includes(draggedId) || !base.includes(targetId) || draggedId === targetId) return;
    if (isFinishedSlice(draggedId) !== isFinishedSlice(targetId)) return;
    const next = base.filter(id => id !== draggedId);
    next.splice(next.indexOf(targetId) + (position === 'after' ? 1 : 0), 0, draggedId);
    if (next.every((id, index) => id === base[index])) return;
    const draggedTitle = slices.find(item => item.id === draggedId)?.title ?? draggedId;
    const targetTitle = slices.find(item => item.id === targetId)?.title ?? targetId;
    setOrderOverride(next);
    setReordering(true);
    setNotice(null);
    try {
      const response = await fetch('/api/story-map/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: next }),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: unknown; changed?: unknown };
      if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : `Reorder failed (${response.status})`);
      const changed = Array.isArray(result.changed) ? result.changed.length : 0;
      setNotice({ kind: 'ok', text: `Moved “${draggedTitle}” ${position === 'before' ? 'above' : 'below'} “${targetTitle}” — slice order saved to ${changed} ${changed === 1 ? 'file' : 'files'}.` });
    } catch (error) {
      setOrderOverride(null);
      setNotice({ kind: 'error', text: `Could not save the slice order: ${(error as Error).message}` });
    } finally {
      setReordering(false);
    }
  }
  const rowDragOver = (sliceId: string) => (event: DragEvent<HTMLDivElement>) => {
    if (!dragSliceId || dragSliceId === sliceId || reordering) return;
    if (isFinishedSlice(dragSliceId) !== isFinishedSlice(sliceId)) {
      event.dataTransfer.dropEffect = 'none';
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const rect = event.currentTarget.getBoundingClientRect();
    const position = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
    setSliceOver(current => current && current.id === sliceId && current.position === position ? current : { id: sliceId, position });
  };
  const rowDragLeave = (sliceId: string) => (event: DragEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setSliceOver(current => current?.id === sliceId ? null : current);
  };
  const rowDrop = (sliceId: string) => (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setSliceOver(null);
    if (!dragSliceId || dragSliceId === sliceId || reordering) { setDragSliceId(null); return; }
    if (isFinishedSlice(dragSliceId) !== isFinishedSlice(sliceId)) { setDragSliceId(null); return; }
    const rect = event.currentTarget.getBoundingClientRect();
    const position = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
    const dragged = dragSliceId;
    setDragSliceId(null);
    void reorderSlices(dragged, sliceId, position);
  };
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
  const defaultCollapsed = (sliceId: string) => isFinishedSlice(sliceId);
  const isCollapsed = (sliceId: string) => collapsedOverrides[sliceId] ?? defaultCollapsed(sliceId);
  return <div className="min-h-screen bg-[#f6f9fc] text-slate-900 antialiased">
    <header className="sticky top-0 z-30 border-b border-slate-900/10 bg-white/80 backdrop-blur-md"><div className="mx-auto flex h-14 w-full max-w-[1800px] items-center gap-3 px-5">
      <Link href="/" className="text-sm font-semibold text-slate-600 transition hover:text-slate-950"><span aria-hidden>←</span> Catalog Forge</Link><span className="h-4 w-px bg-slate-200" /><h1 className="text-sm font-semibold text-slate-950">Story map</h1>
      <span className="hidden items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-800 ring-1 ring-inset ring-amber-600/20 sm:inline-flex"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />Internal · dev only</span>
      <Link className="ml-auto rounded-lg border border-slate-200 px-3.5 py-1.5 text-sm font-semibold text-slate-700 transition hover:border-slate-950/30 hover:text-slate-950" href="/story-map/experiments">Design lab</Link>
      <Link className="rounded-lg bg-slate-950 px-3.5 py-1.5 text-sm font-semibold text-white transition hover:bg-slate-800" href="/editor">Open editor</Link>
    </div></header>
    <main className="mx-auto max-w-[1800px] space-y-5 p-5">
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
        {shownSlices.map((slice, sliceIndex) => {
          if (isCollapsed(slice.id)) {
            const done = stories.filter(s => s.slice === slice.id && s.status === 'done').length;
            const total = sliceTotalCount(slice.id);
            const pct = total ? Math.round((done / total) * 100) : 0;
            return <div
              key={slice.id}
              onDragOver={rowDragOver(slice.id)}
              onDragLeave={rowDragLeave(slice.id)}
              onDrop={rowDrop(slice.id)}
              className="relative border-b border-slate-900/10 bg-white"
            >
              {sliceOver?.id === slice.id && sliceOver.position === 'before' && <div aria-hidden className="absolute inset-x-4 top-0 z-20 h-0.5 rounded-full bg-indigo-500" />}
              <div className="flex items-center gap-1 py-3 pl-2 pr-4">
              <SliceGrip sliceId={slice.id} disabled={!canReorderSlices} onDragStart={setDragSliceId} onDragEnd={() => { setDragSliceId(null); setSliceOver(null); }} />
              <button
              type="button"
              aria-expanded={false}
              title={`Expand ${slice.title}`}
              onClick={() => setCollapsedOverrides(previous => ({ ...previous, [slice.id]: false }))}
              className="group min-w-0 flex-1 rounded-lg text-left transition hover:bg-slate-50/70"
            >
              <span className="sticky left-0 flex w-max max-w-full flex-wrap items-center gap-x-3 gap-y-1.5">
                <svg viewBox="0 0 12 12" aria-hidden className="h-3 w-3 shrink-0 text-slate-400" fill="none"><path d="M4.5 3 7.5 6 4.5 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Slice {String(sliceIndex + 1).padStart(2, '0')} · {pct}% complete</span>
                <span className="truncate text-sm font-bold tracking-tight text-slate-800">{slice.title}</span>
                <span aria-hidden className="hidden h-1.5 w-40 shrink-0 overflow-hidden rounded-full bg-slate-900/10 sm:block">
                  <span className="block h-full rounded-full bg-gradient-to-r from-indigo-400 to-emerald-400" style={{ width: `${pct}%` }} />
                </span>
                <span className="shrink-0 rounded-lg bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 ring-1 ring-inset ring-slate-900/10 transition group-hover:ring-slate-900/25">Expand</span>
              </span>
            </button>
              </div>
              {sliceOver?.id === slice.id && sliceOver.position === 'after' && <div aria-hidden className="absolute inset-x-4 bottom-0 z-20 h-0.5 rounded-full bg-indigo-500" />}
            </div>;
          }
          const sliceDone = stories.filter(s => s.slice === slice.id && s.status === 'done').length;
          const sliceTotal = sliceTotalCount(slice.id);
          const slicePct = sliceTotal ? Math.round((sliceDone / sliceTotal) * 100) : 0;
          return <div
            key={slice.id}
            className="relative grid"
            style={columns}
            onDragOver={rowDragOver(slice.id)}
            onDragLeave={rowDragLeave(slice.id)}
            onDrop={rowDrop(slice.id)}
          >
          {sliceOver?.id === slice.id && sliceOver.position === 'before' && <div aria-hidden className="absolute inset-x-4 top-0 z-20 h-0.5 rounded-full bg-indigo-500" />}
          <div className="sticky left-0 z-10 border-b border-r border-slate-900/10 bg-white p-4">
          <div className="flex h-full gap-3">
          <span aria-hidden className={`w-1 shrink-0 self-stretch rounded-full ${TONE_BAR[slice.tone]}`} />
          <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5"><SliceGrip sliceId={slice.id} disabled={!canReorderSlices} onDragStart={setDragSliceId} onDragEnd={() => { setDragSliceId(null); setSliceOver(null); }} /><p className="flex-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Slice {String(sliceIndex + 1).padStart(2, '0')}</p><button
            type="button"
            aria-expanded={true}
            aria-label={`Collapse ${slice.title}`}
            title="Collapse slice"
            onClick={() => setCollapsedOverrides(previous => ({ ...previous, [slice.id]: true }))}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-300 transition hover:bg-slate-900/5 hover:text-slate-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            <svg viewBox="0 0 12 12" aria-hidden className="h-3 w-3" fill="none"><path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button></div><h3 className="mt-0.5 truncate text-sm font-bold tracking-tight text-slate-900" title={slice.title}>{slice.title}</h3><p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">{slice.description}</p>
          <div className="mt-2.5 flex items-center gap-2"><div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-900/10"><div className="h-full rounded-full bg-slate-700 transition-all" style={{ width: `${slicePct}%` }} /></div><span className="text-[11px] font-semibold tabular-nums text-slate-500">{sliceDone}/{sliceTotal}</span></div>
          <div className="mt-2 flex gap-3 text-[11px] font-semibold"><Link href={sliceUrl(slice)} className="text-slate-500 underline-offset-4 hover:text-slate-900 hover:underline">Spec</Link><Link href={notesUrl(slice)} className="text-slate-500 underline-offset-4 hover:text-slate-900 hover:underline">Notes</Link></div>
          </div>
          </div></div>
          {shownSteps.map(s => {
            const cellKey = `${slice.id}:${s.id}`;
            return <div
              key={s.id}
              onDragOver={event => { if (dragSliceId) return; event.preventDefault(); if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'; setOverCell(cellKey); }}
              onDragLeave={() => setOverCell(key => key === cellKey ? null : key)}
              onDrop={event => {
                event.preventDefault();
                if (dragSliceId) return;
                const id = event.dataTransfer?.getData('text/plain') || dragId;
                setOverCell(null);
                if (id) void moveStory(id, slice.id, s.id);
              }}
              className={`min-h-28 space-y-3 border-b border-r border-slate-900/[0.06] bg-slate-50/60 p-3 transition ${overCell === cellKey ? 'ring-2 ring-inset ring-indigo-500' : ''}`}
            >
            {visibleStories.filter(story => story.slice === slice.id && story.step === s.id).map(story => <StoryCard
                key={story.id}
                story={story}
                stories={stories}
                dimmed={dragId === story.id}
                saving={savingId === story.id}
                savingKind={savingKind}
                onDragStart={event => { event.dataTransfer.setData('text/plain', story.id); event.dataTransfer.effectAllowed = 'move'; setDragId(story.id); }}
                onDragEnd={() => { setDragId(null); setOverCell(null); }}
                onStatusSelect={status => void changeStatus(story.id, status)}
              />)}
            </div>;
          })}
          {sliceOver?.id === slice.id && sliceOver.position === 'after' && <div aria-hidden className="absolute inset-x-4 bottom-0 z-20 h-0.5 rounded-full bg-indigo-500" />}
        </div>; })}
        </div>
      </div>}
      <p className="text-xs leading-relaxed text-slate-400">Drag a card to another column or slice to move it — moves save to the story Markdown in local dev. Drag a slice by its grip to reorder it — order saves to the slice Markdown the same way. Click a status label to change it — status changes save the same way. Hover the ⓘ for the full summary; acceptance criteria start collapsed. Slices where every story is done or won&apos;t do start collapsed and stay grouped at the bottom; click the slice bar to expand it. Edit story Markdown directly to change anything else. Only your filters are stored in this browser.</p>
    </main>
  </div>;
}
