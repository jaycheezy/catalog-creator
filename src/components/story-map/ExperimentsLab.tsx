'use client';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import steps from '@/story-map/steps.json';
import {
  isReady,
  statusLabels,
  storyUrl,
  sliceUrl,
  notesUrl,
  unmetDependencies,
  type Slice as SliceType,
  type Story as StoryType,
  type StoryStatus,
} from '@/story-map/model';

type VersionId = 'compact' | 'signal' | 'narrative';

const VERSIONS: { id: VersionId; name: string; tagline: string }[] = [
  { id: 'compact', name: 'A · Compact', tagline: 'Quiet & scannable' },
  { id: 'signal', name: 'B · Signal', tagline: 'Status at a glance' },
  { id: 'narrative', name: 'C · Narrative', tagline: 'Context-rich cards' },
];

const STATUS_ORDER: StoryStatus[] = ['proposed', 'ready', 'in-progress', 'in-review', 'done', 'wont-do'];

const STATUS_DOT: Record<StoryStatus, string> = {
  proposed: 'bg-slate-400',
  ready: 'bg-indigo-500',
  'in-progress': 'bg-amber-500',
  'in-review': 'bg-sky-500',
  done: 'bg-emerald-500',
  'wont-do': 'bg-white ring-1 ring-inset ring-slate-400',
};

const STATUS_ACCENT: Record<StoryStatus, string> = {
  proposed: 'border-l-slate-300',
  ready: 'border-l-indigo-500',
  'in-progress': 'border-l-amber-500',
  'in-review': 'border-l-sky-500',
  done: 'border-l-emerald-500',
  'wont-do': 'border-l-slate-200',
};

const TONE_BAR: Record<SliceType['tone'], string> = {
  green: 'bg-emerald-400',
  blue: 'bg-sky-400',
  violet: 'bg-indigo-400',
  amber: 'bg-amber-400',
  zinc: 'bg-slate-300',
};

const TONE_CELL: Record<SliceType['tone'], string> = {
  green: 'bg-emerald-50/50',
  blue: 'bg-sky-50/50',
  violet: 'bg-indigo-50/50',
  amber: 'bg-amber-50/50',
  zinc: 'bg-slate-100/50',
};

type SliceStats = { total: number; done: number; terminal: number; ready: number; blocked: number; pct: number };

function getSliceStats(sliceId: string, stories: StoryType[]): SliceStats {
  const items = stories.filter(s => s.slice === sliceId);
  const done = items.filter(s => s.status === 'done').length;
  const terminal = items.filter(s => s.status === 'done' || s.status === 'wont-do').length;
  const ready = items.filter(s => isReady(s, stories)).length;
  const blocked = items.filter(s => s.status !== 'done' && s.status !== 'wont-do' && unmetDependencies(s, stories).length > 0).length;
  return { total: items.length, done, terminal, ready, blocked, pct: items.length ? Math.round((done / items.length) * 100) : 0 };
}

function VersionIntro({ title, slices, stories, tryThis }: { title: string; slices: string; stories: string; tryThis: string }) {
  return (
    <div className="grid gap-3 rounded-2xl border border-slate-900/[0.07] bg-white p-4 text-sm shadow-sm md:grid-cols-3">
      <div><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-indigo-600">Stays the same</p><p className="mt-1 leading-relaxed text-slate-500">Slice rows × journey-step columns, same order, same filters. Only the slice rail and story cards change.</p></div>
      <div><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-indigo-600">What changed</p><p className="mt-1 leading-relaxed text-slate-500"><span className="font-semibold text-slate-700">{title}. </span>{slices} <span className="text-slate-300">·</span> {stories}</p></div>
      <div><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-indigo-600">Try this</p><p className="mt-1 leading-relaxed text-slate-500">{tryThis}</p></div>
    </div>
  );
}

/* ————————————————— Shared grid: identical steps across versions ————————————————— */

function MapGrid({
  shownSteps,
  shownSlices,
  visibleStories,
  stories,
  renderSlice,
  renderCollapsed,
  renderCard,
  cellClass,
}: {
  shownSteps: typeof steps;
  shownSlices: SliceType[];
  visibleStories: StoryType[];
  stories: StoryType[];
  renderSlice: (slice: SliceType, stats: SliceStats, index: number, onCollapse: () => void) => ReactNode;
  renderCollapsed: (slice: SliceType, stats: SliceStats, index: number, onExpand: () => void) => ReactNode;
  renderCard: (story: StoryType) => ReactNode;
  cellClass: (slice: SliceType) => string;
}) {
  const columns = { gridTemplateColumns: `220px repeat(${shownSteps.length}, minmax(250px, 1fr))` };
  // Matches the real map: slices where every story is done or won't-do start minimized.
  const [collapsedOverrides, setCollapsedOverrides] = useState<Record<string, boolean>>({});
  const isFinished = (sliceId: string) => {
    const items = stories.filter(item => item.slice === sliceId);
    return items.length > 0 && items.every(item => item.status === 'done' || item.status === 'wont-do');
  };
  const isCollapsed = (sliceId: string) => collapsedOverrides[sliceId] ?? isFinished(sliceId);
  return (
    <div aria-label="Story map by slice and journey step">
      <div className="overflow-x-hidden rounded-t-2xl border border-b-0 border-slate-900/10 bg-white">
        <div className="grid" style={columns}>
          <div className="border-b border-r border-slate-900/10 bg-slate-50 p-4 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Slices ↓ · Journey →</div>
          {shownSteps.map(s => (
            <div key={s.id} className="border-b border-r border-slate-900/10 bg-slate-50/80 p-4">
              <h3 className="text-sm font-bold tracking-tight text-slate-900">{s.title}</h3>
              <p className="mt-0.5 text-xs text-slate-400">{s.subtitle}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto rounded-b-2xl border border-t-0 border-slate-900/10 bg-white shadow-[0_8px_24px_-12px_rgba(16,24,40,0.12)]">
        {shownSlices.map((slice, i) => {
          const stats = getSliceStats(slice.id, stories);
          if (isCollapsed(slice.id)) {
            return (
              <div key={slice.id} className="border-b border-slate-900/10">
                {renderCollapsed(slice, stats, i, () => setCollapsedOverrides(previous => ({ ...previous, [slice.id]: false })))}
              </div>
            );
          }
          return (
            <div key={slice.id} className="grid" style={columns}>
              <div className="sticky left-0 z-10 border-b border-r border-slate-900/10 bg-white">
                {renderSlice(slice, stats, i, () => setCollapsedOverrides(previous => ({ ...previous, [slice.id]: true })))}
              </div>
              {shownSteps.map(s => (
                <div key={s.id} className={`min-h-28 space-y-3 border-b border-r border-slate-900/[0.06] p-3 ${cellClass(slice)}`}>
                  {visibleStories.filter(story => story.slice === slice.id && story.step === s.id).map(story => (
                    <div key={story.id}>{renderCard(story)}</div>
                  ))}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ————————————————— A · Compact: quiet slice rail + dense cards ————————————————— */

function SliceRailCompact({ slice, stats, index, onCollapse }: { slice: SliceType; stats: SliceStats; index: number; onCollapse: () => void }) {
  return (
    <div className="flex h-full gap-3 p-4">
      <span aria-hidden className={`w-1 shrink-0 self-stretch rounded-full ${TONE_BAR[slice.tone]}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Slice {String(index + 1).padStart(2, '0')}</p>
          <button
            type="button"
            onClick={onCollapse}
            aria-label={`Collapse ${slice.title}`}
            title="Collapse slice"
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-300 transition hover:bg-slate-900/5 hover:text-slate-600 focus-visible:outline-2 focus-visible:outline-indigo-600"
          >
            <svg viewBox="0 0 12 12" aria-hidden className="h-3 w-3" fill="none"><path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
        <h3 className="mt-0.5 truncate text-sm font-bold tracking-tight text-slate-900" title={slice.title}>{slice.title}</h3>
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">{slice.description}</p>
        <div className="mt-2.5 flex items-center gap-2">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-900/10"><div className="h-full rounded-full bg-slate-700" style={{ width: `${stats.pct}%` }} /></div>
          <span className="text-[11px] font-semibold tabular-nums text-slate-500">{stats.done}/{stats.total}</span>
        </div>
        <div className="mt-2 flex gap-3 text-[11px] font-semibold">
          <Link href={sliceUrl(slice)} className="text-slate-500 underline-offset-4 hover:text-slate-900 hover:underline">Spec</Link>
          <Link href={notesUrl(slice)} className="text-slate-500 underline-offset-4 hover:text-slate-900 hover:underline">Notes</Link>
        </div>
      </div>
    </div>
  );
}

function CompactStatusMenu({ story, overridden, onSelect }: { story: StoryType; overridden: boolean; onSelect: (status: StoryStatus) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
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
  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Change status of ${story.title}, currently ${statusLabels[story.status]}`}
        title="Change status (lab preview — not saved)"
        onClick={() => setOpen(value => !value)}
        className={`flex items-center gap-1.5 rounded px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-indigo-600 ${overridden ? 'text-indigo-700' : 'text-slate-500'}`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[story.status]}`} />
        {statusLabels[story.status]}
        <svg viewBox="0 0 12 12" aria-hidden className={`h-2.5 w-2.5 opacity-60 transition-transform ${open ? 'rotate-180' : ''}`} fill="none"><path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {open && (
        <div role="menu" aria-label={`Set status for ${story.title}`} className="absolute left-0 top-full z-30 mt-1 w-44 rounded-xl border border-slate-200 bg-white p-1 text-left shadow-xl">
          {STATUS_ORDER.map(value => (
            <button
              key={value}
              type="button"
              role="menuitem"
              onClick={() => { setOpen(false); if (value !== story.status) onSelect(value); }}
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] font-medium transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-indigo-600 ${value === story.status ? 'bg-slate-100' : ''}`}
            >
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[value]}`} />
              <span className="flex-1 text-slate-700">{statusLabels[value]}</span>
              {value === story.status && <span aria-hidden className="text-[11px] font-bold text-slate-400">✓</span>}
            </button>
          ))}
          <p className="px-2 pb-1 pt-1 text-[10px] leading-snug text-slate-400">Lab preview — doesn&apos;t save to Markdown.</p>
        </div>
      )}
    </div>
  );
}

function CardCompact({ story, stories, overridden, onStatusChange }: { story: StoryType; stories: StoryType[]; overridden: boolean; onStatusChange: (id: string, status: StoryStatus) => void }) {
  const blocked = unmetDependencies(story, stories);
  return (
    <article className={`rounded-lg border bg-white p-2.5 shadow-[0_1px_2px_rgba(16,24,40,0.06)] transition hover:border-slate-400 ${overridden ? 'border-indigo-300 ring-1 ring-indigo-200' : 'border-slate-900/10'}`}>
      <div className="flex items-center gap-1.5 text-[10px] font-medium normal-case tracking-normal text-slate-400">
        <CompactStatusMenu story={story} overridden={overridden} onSelect={status => onStatusChange(story.id, status)} />
        <span className="ml-auto font-semibold">{story.effort}</span>
        <span className="group/sum relative shrink-0">
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
        </span>
      </div>
      <h4 className="mt-1 text-[13px] font-semibold leading-snug text-slate-900">{story.title}</h4>
      <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-500" title={story.description}>{story.description}</p>
      {story.value && (
        <p className="mt-1.5 line-clamp-2 border-l-2 border-slate-200 pl-1.5 text-[11px] leading-snug text-slate-600">
          <span className="font-bold text-slate-500">Why: </span>{story.value}
        </p>
      )}
      {story.acceptance.length > 0 && (
        <details className="group mt-1.5 rounded-md bg-slate-50 ring-1 ring-inset ring-slate-900/5">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 px-1.5 py-1 text-[11px] font-semibold text-slate-500 transition hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-indigo-600 [&::-webkit-details-marker]:hidden">
            <svg viewBox="0 0 12 12" aria-hidden className="h-2.5 w-2.5 shrink-0 text-slate-400 transition-transform group-open:rotate-90" fill="none"><path d="M4.5 3 7.5 6 4.5 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            {story.acceptance.length} acceptance {story.acceptance.length === 1 ? 'criterion' : 'criteria'}
          </summary>
          <ul className="space-y-1 px-1.5 pb-1.5">
            {story.acceptance.map(a => (
              <li key={a} className="flex gap-1.5 text-[11px] leading-snug text-slate-600">
                <span aria-hidden className="mt-px flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border border-slate-300 bg-white text-[9px] font-bold leading-none text-slate-400">✓</span>
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      {blocked.length > 0 && <p className="mt-1.5 text-[11px] font-medium text-amber-700">⧗ Waiting on {blocked.length} — finish deps first</p>}
      <div className="mt-1.5 flex items-center gap-2 border-t border-slate-100 pt-1.5 text-[11px]">
        <span className="font-mono text-[10px] text-slate-400">{story.id}</span>
        {overridden && <span className="rounded bg-indigo-50 px-1.5 py-px text-[10px] font-bold text-indigo-700">PREVIEW</span>}
        {story.implementation === 'outline' && <span className="rounded bg-slate-100 px-1.5 py-px text-[10px] font-bold text-slate-500">OUTLINE</span>}
        <Link href={storyUrl(story)} aria-label={`Open spec for ${story.title}`} className="ml-auto font-bold text-slate-600 hover:text-slate-950">→</Link>
      </div>
    </article>
  );
}

/* ————————————————— B · Signal: health-first slice rail + status-coded cards ————————————————— */

function SliceRailSignal({ slice, stats, onCollapse }: { slice: SliceType; stats: SliceStats; index: number; onCollapse: () => void }) {
  const open = Math.max(stats.total - stats.terminal, 0);
  return (
    <div className={`h-full border-t-4 p-4 ${TONE_CELL[slice.tone]}`} style={{ borderTopColor: 'transparent' }}>
      <div className="flex items-center gap-2">
        <h3 className="min-w-0 flex-1 truncate text-sm font-bold tracking-tight text-slate-900" title={slice.title}>{slice.title}</h3>
        {stats.ready > 0
          ? <span className="shrink-0 rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">{stats.ready} ready</span>
          : stats.blocked > 0
            ? <span className="shrink-0 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">{stats.blocked} blocked</span>
            : open === 0 && <span className="shrink-0 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Clear</span>}
        <button
          type="button"
          onClick={onCollapse}
          aria-label={`Collapse ${slice.title}`}
          title="Collapse slice"
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 transition hover:bg-slate-900/5 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-indigo-600"
        >
          <svg viewBox="0 0 12 12" aria-hidden className="h-3 w-3" fill="none"><path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>
      {/* Segmented health bar: done vs remaining open vs dropped */}
      <div className="mt-2.5 flex h-2 overflow-hidden rounded-full bg-white ring-1 ring-inset ring-slate-900/10" role="img" aria-label={`${stats.done} of ${stats.total} done`}>
        <div className="bg-emerald-500" style={{ width: `${stats.total ? (stats.done / stats.total) * 100 : 0}%` }} />
        <div className="bg-indigo-400" style={{ width: `${stats.total ? (stats.ready / stats.total) * 100 : 0}%` }} />
      </div>
      <p className="mt-1.5 text-[11px] font-semibold tabular-nums text-slate-600">{stats.done}/{stats.total} done · {open} open</p>
      <div className="mt-2 flex gap-3 text-[11px] font-bold">
        <Link href={sliceUrl(slice)} className="text-indigo-700 underline-offset-4 hover:underline">Spec →</Link>
        <Link href={notesUrl(slice)} className="text-indigo-700 underline-offset-4 hover:underline">Notes →</Link>
      </div>
    </div>
  );
}

function CardSignal({ story, stories }: { story: StoryType; stories: StoryType[] }) {
  const blocked = unmetDependencies(story, stories);
  return (
    <article className={`rounded-lg border border-slate-900/10 border-l-4 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.06)] transition hover:shadow-[0_6px_16px_-8px_rgba(16,24,40,0.35)] ${STATUS_ACCENT[story.status]}`}>
      {blocked.length > 0 && (
        <p className="rounded-t-[7px] border-b border-amber-200/70 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800">⧗ Waiting on {blocked.length} — finish deps first</p>
      )}
      <div className="p-2.5">
        <div className="flex items-center gap-1.5">
          <span className="rounded-md bg-slate-950 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">{statusLabels[story.status]}</span>
          <span className="text-[10px] font-semibold text-slate-400">{story.effort}</span>
          {story.implementation === 'outline' && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">OUTLINE</span>}
        </div>
        <h4 className="mt-1.5 text-[13px] font-bold leading-snug text-slate-900">{story.title}</h4>
        {blocked.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {blocked.map(id => (
              <span key={id} className="rounded-full bg-amber-50 px-2 py-0.5 font-mono text-[10px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-600/20">{id}</span>
            ))}
          </div>
        )}
        <div className="mt-2 flex items-center text-[11px] font-bold">
          <span className="text-slate-400">{story.acceptance.length} checks</span>
          <Link href={storyUrl(story)} className="ml-auto text-indigo-700 hover:text-indigo-900 hover:underline">View spec →</Link>
        </div>
      </div>
    </article>
  );
}

/* ————————————————— C · Narrative: editorial slice rail + context cards ————————————————— */

function SliceRailNarrative({ slice, stats, index, onCollapse }: { slice: SliceType; stats: SliceStats; index: number; onCollapse: () => void }) {
  return (
    <div className={`h-full p-4 ${TONE_CELL[slice.tone]}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Slice {String(index + 1).padStart(2, '0')} · {stats.pct}% complete</p>
        <button
          type="button"
          onClick={onCollapse}
          aria-label={`Collapse ${slice.title}`}
          title="Collapse slice"
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 transition hover:bg-slate-900/5 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-indigo-600"
        >
          <svg viewBox="0 0 12 12" aria-hidden className="h-3 w-3" fill="none"><path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>
      <h3 className="mt-1 text-[15px] font-bold leading-tight tracking-tight text-slate-900">{slice.title}</h3>
      <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-slate-600">{slice.description}</p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/80 ring-1 ring-inset ring-slate-900/10">
        <div className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-emerald-400" style={{ width: `${stats.pct}%` }} />
      </div>
      <p className="mt-1.5 text-[11px] font-medium text-slate-500">{stats.done} of {stats.total} stories done{stats.ready > 0 ? ` · ${stats.ready} ready to assign` : ''}</p>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <Link href={sliceUrl(slice)} className="rounded-lg bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 ring-1 ring-inset ring-slate-900/10 transition hover:ring-slate-900/25">Read spec</Link>
        <Link href={notesUrl(slice)} className="rounded-lg bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 ring-1 ring-inset ring-slate-900/10 transition hover:ring-slate-900/25">Notes</Link>
      </div>
    </div>
  );
}

function CardNarrative({ story, stories }: { story: StoryType; stories: StoryType[] }) {
  const blocked = unmetDependencies(story, stories);
  return (
    <article className="rounded-xl border border-slate-900/10 bg-white p-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.06),0_8px_20px_-14px_rgba(16,24,40,0.25)] transition hover:border-indigo-200">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
        <span className={`h-2 w-2 rounded-full ${STATUS_DOT[story.status]}`} />
        {statusLabels[story.status]}
        <span aria-hidden className="text-slate-200">·</span>
        <span>{story.effort}</span>
        <span aria-hidden className="text-slate-200">·</span>
        <span>{story.acceptance.length} checks</span>
      </div>
      <h4 className="mt-1.5 text-sm font-bold leading-snug tracking-tight text-slate-900">{story.title}</h4>
      {story.value && <p className="mt-1.5 border-l-2 border-indigo-200 pl-2 text-xs italic leading-relaxed text-slate-600 line-clamp-2">“{story.value}”</p>}
      <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-500">{story.description}</p>
      {story.acceptance.length > 0 && (
        <ul className="mt-2 space-y-1 rounded-lg bg-slate-50 p-2 text-[11px] leading-relaxed text-slate-600">
          {story.acceptance.slice(0, 2).map(a => <li key={a} className="flex gap-1.5"><span aria-hidden className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-slate-300" />{a}</li>)}
          {story.acceptance.length > 2 && <li className="pl-2.5 font-semibold text-slate-400">+{story.acceptance.length - 2} more in spec</li>}
        </ul>
      )}
      {blocked.length > 0 && (
        <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1.5 text-[11px] leading-relaxed text-amber-800 ring-1 ring-inset ring-amber-600/15">
          <span className="font-bold">Depends on: </span>{blocked.map(id => stories.find(s => s.id === id)?.title ?? id).join(' · ')}
        </p>
      )}
      <Link href={storyUrl(story)} className="mt-2.5 inline-block text-xs font-bold text-indigo-700 underline-offset-4 hover:text-indigo-900 hover:underline">Read the full spec →</Link>
    </article>
  );
}

/* ————————————————— Minimized slice rows (one per direction) ————————————————— */

function CollapsedBarSignal({ slice, stats, onExpand }: { slice: SliceType; stats: SliceStats; index: number; onExpand: () => void }) {
  return (
    <button
      type="button"
      onClick={onExpand}
      aria-expanded={false}
      title={`Expand ${slice.title}`}
      className={`block w-full px-4 py-2.5 text-left transition hover:brightness-[0.98] ${TONE_CELL[slice.tone]}`}
    >
      <span className="sticky left-0 inline-flex w-max max-w-full items-center gap-2.5">
        <svg viewBox="0 0 12 12" aria-hidden className="h-3 w-3 shrink-0 text-slate-400" fill="none"><path d="M4.5 3 7.5 6 4.5 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        <span className="truncate text-[13px] font-bold text-slate-700">{slice.title}</span>
        <span className="shrink-0 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">✓ Clear · {stats.done}/{stats.total} done</span>
        <span aria-hidden className="hidden h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-white ring-1 ring-inset ring-slate-900/10 sm:block">
          <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${stats.pct}%` }} />
        </span>
        <span className="shrink-0 text-[11px] font-bold text-slate-500">Expand →</span>
      </span>
    </button>
  );
}

function CollapsedBarNarrative({ slice, stats, index, onExpand }: { slice: SliceType; stats: SliceStats; index: number; onExpand: () => void }) {
  return (
    <button
      type="button"
      onClick={onExpand}
      aria-expanded={false}
      title={`Expand ${slice.title}`}
      className="block w-full bg-white px-4 py-3 text-left transition hover:bg-slate-50/70"
    >
      <span className="sticky left-0 flex w-max max-w-full flex-wrap items-center gap-x-3 gap-y-1.5">
        <svg viewBox="0 0 12 12" aria-hidden className="h-3 w-3 shrink-0 text-slate-400" fill="none"><path d="M4.5 3 7.5 6 4.5 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Slice {String(index + 1).padStart(2, '0')} · {stats.pct}% complete</span>
        <span className="truncate text-sm font-bold tracking-tight text-slate-800">{slice.title}</span>
        <span aria-hidden className="hidden h-1.5 w-40 shrink-0 overflow-hidden rounded-full bg-slate-900/10 sm:block">
          <span className="block h-full rounded-full bg-gradient-to-r from-indigo-400 to-emerald-400" style={{ width: `${stats.pct}%` }} />
        </span>
        <span className="shrink-0 rounded-lg bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 ring-1 ring-inset ring-slate-900/10">Expand</span>
      </span>
    </button>
  );
}

/* ————————————————— Lab shell ————————————————— */

export function ExperimentsLab({ stories, slices }: { stories: StoryType[]; slices: SliceType[] }) {
  const [version, setVersion] = useState<VersionId>('compact');
  const [step, setStep] = useState('all');
  const [sliceFilter, setSliceFilter] = useState('all');
  const [query, setQuery] = useState('');
  // Local-only status previews for the Compact tab: lets you try the status
  // menu design without writing to Markdown. Other tabs use shared data.
  const [statusPreview, setStatusPreview] = useState<Record<string, StoryStatus>>({});
  const previewStatus = (id: string, status: StoryStatus) => setStatusPreview(previous => {
    const original = stories.find(item => item.id === id)?.status;
    if (status === original) {
      const next = { ...previous };
      delete next[id];
      return next;
    }
    return { ...previous, [id]: status };
  });
  const previewCount = Object.keys(statusPreview).length;
  const compactStories = useMemo(
    () => stories.map(item => statusPreview[item.id] ? { ...item, status: statusPreview[item.id] } : item),
    [stories, statusPreview],
  );

  const shownSteps = useMemo(() => steps.filter(item => step === 'all' || item.id === step), [step]);
  const shownSlices = useMemo(
    () => slices.filter(item => sliceFilter === 'all' || item.id === sliceFilter).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id)),
    [slices, sliceFilter],
  );
  const visibleStories = useMemo(() => {
    const q = query.trim().toLowerCase();
    return stories.filter(item =>
      (step === 'all' || item.step === step) &&
      (sliceFilter === 'all' || item.slice === sliceFilter) &&
      (!q || `${item.title} ${item.description} ${item.value} ${item.id}`.toLowerCase().includes(q)),
    );
  }, [stories, step, sliceFilter, query]);

  return (
    <div className="min-h-screen bg-[#f6f9fc] text-slate-900 antialiased">
      <header className="sticky top-0 z-30 border-b border-slate-900/10 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-[1800px] items-center gap-3 px-5">
          <Link href="/story-map" className="text-sm font-semibold text-slate-600 transition hover:text-slate-950"><span aria-hidden>←</span> Story map</Link>
          <span className="h-4 w-px bg-slate-200" />
          <h1 className="text-sm font-semibold text-slate-950">Slice & story treatments</h1>
          <span className="hidden items-center gap-1.5 rounded-full bg-violet-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-violet-800 ring-1 ring-inset ring-violet-600/20 sm:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />Lab · dev only · read-only
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-[1800px] space-y-5 p-5">
        <section className="rounded-2xl border border-slate-900/[0.07] bg-white p-5 shadow-sm sm:p-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-violet-700">Same map, new skin</p>
          <h2 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">Three directions for slices & story cards</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-500">
            Layout is untouched — {slices.length} slice rows × {steps.length} journey-step columns, same order, same data.
            Only the slice rail (left cell), the minimized slice bar, and the story card change. {visibleStories.length} stories shown with the filters below.
            Like the real map, slices where every story is done or won&apos;t do start minimized — click a bar to expand it.
            Nothing here writes to disk.
          </p>
          <div role="tablist" aria-label="Design versions" className="mt-4 flex flex-wrap gap-2">
            {VERSIONS.map(v => {
              const active = v.id === version;
              return (
                <button
                  key={v.id}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setVersion(v.id)}
                  className={`rounded-xl border px-4 py-2.5 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${active ? 'border-slate-950 bg-slate-950 text-white shadow' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-950/30 hover:text-slate-950'}`}
                >
                  <span className="block text-sm font-bold">{v.name}</span>
                  <span className={`block text-xs ${active ? 'text-slate-300' : 'text-slate-400'}`}>{v.tagline}</span>
                </button>
              );
            })}
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl border border-slate-900/[0.07] bg-white p-4 text-sm shadow-sm">
          <label className="flex items-center gap-2 font-medium text-slate-600">Journey step
            <select value={step} onChange={e => setStep(e.target.value)} className="max-w-56 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100">
              <option value="all">All steps</option>{steps.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 font-medium text-slate-600">Slice
            <select value={sliceFilter} onChange={e => setSliceFilter(e.target.value)} className="max-w-64 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100">
              <option value="all">All slices</option>{slices.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
          </label>
          <label className="flex min-w-48 flex-1 items-center gap-2 font-medium text-slate-600">Search
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Filter cards…" className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
          </label>
          <button className="text-xs font-medium text-slate-400 underline underline-offset-4 transition hover:text-slate-700" onClick={() => { setStep('all'); setSliceFilter('all'); setQuery(''); }}>Clear filters</button>
        </div>

        {version === 'compact' && (
          <div className="space-y-4">
            <VersionIntro
              title="A · Compact"
              slices="Slice rail: white, tone tick, numbered kicker, 2-line description, hairline progress bar with done/total."
              stories="Cards: clickable status menu (local preview), ⓘ hover for the full summary, Why line, acceptance criteria in a collapsed accordion, story id + outline flag in the footer."
              tryThis="Click a status label and pick a new state — the card previews it without saving. Hover the ⓘ for the full summary. Expand a criteria accordion, then collapse a slice rail and expand a minimized row."
            />
            {previewCount > 0 && (
              <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-3 text-sm">
                <p className="text-indigo-900"><span className="font-bold">{previewCount} status {previewCount === 1 ? 'change' : 'changes'}</span> previewed locally — nothing saved.</p>
                <button type="button" onClick={() => setStatusPreview({})} className="ml-auto rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-indigo-700 ring-1 ring-inset ring-indigo-200 transition hover:ring-indigo-400">Reset previews</button>
              </div>
            )}
            <MapGrid
              shownSteps={shownSteps} shownSlices={shownSlices} visibleStories={visibleStories} stories={compactStories}
              renderSlice={(slice, stats, i, onCollapse) => <SliceRailCompact slice={slice} stats={stats} index={i} onCollapse={onCollapse} />}
              renderCollapsed={(slice, stats, i, onExpand) => <CollapsedBarNarrative slice={slice} stats={stats} index={i} onExpand={onExpand} />}
              renderCard={story => {
                const live = statusPreview[story.id] ? { ...story, status: statusPreview[story.id] } : story;
                return <CardCompact story={live} stories={compactStories} overridden={statusPreview[story.id] !== undefined} onStatusChange={previewStatus} />;
              }}
              cellClass={() => 'bg-slate-50/60'}
            />
          </div>
        )}
        {version === 'signal' && (
          <div className="space-y-4">
            <VersionIntro
              title="B · Signal"
              slices="Slice rail: health-first — ready/blocked/clear badge, segmented done-vs-ready bar, open count, tinted tone wash."
              stories="Cards: 4px status-colored left edge, solid status chip, amber waiting banner + dependency id chips, outline flag, spec CTA."
              tryThis="Glance down the left rails only: which slice needs attention first? Then scan cards: does status read before you read the title? Collapse an open slice and expand a minimized one."
            />
            <MapGrid
              shownSteps={shownSteps} shownSlices={shownSlices} visibleStories={visibleStories} stories={stories}
              renderSlice={(slice, stats, i, onCollapse) => <SliceRailSignal slice={slice} stats={stats} index={i} onCollapse={onCollapse} />}
              renderCollapsed={(slice, stats, i, onExpand) => <CollapsedBarSignal slice={slice} stats={stats} index={i} onExpand={onExpand} />}
              renderCard={story => <CardSignal story={story} stories={stories} />}
              cellClass={() => 'bg-white'}
            />
          </div>
        )}
        {version === 'narrative' && (
          <div className="space-y-4">
            <VersionIntro
              title="C · Narrative"
              slices="Slice rail: editorial — % kicker, larger title, 3-line description, gradient progress bar, button-style spec/notes links."
              stories="Cards: larger type, why-it-matters quote, acceptance preview (2 + overflow count), dependency titles in context, full spec link."
              tryThis="Read one slice row top-to-bottom without clicking. Ask: do you understand why the slice and each story exist? Then try its minimized row."
            />
            <MapGrid
              shownSteps={shownSteps} shownSlices={shownSlices} visibleStories={visibleStories} stories={stories}
              renderSlice={(slice, stats, i, onCollapse) => <SliceRailNarrative slice={slice} stats={stats} index={i} onCollapse={onCollapse} />}
              renderCollapsed={(slice, stats, i, onExpand) => <CollapsedBarNarrative slice={slice} stats={stats} index={i} onExpand={onExpand} />}
              renderCard={story => <CardNarrative story={story} stories={stories} />}
              cellClass={slice => TONE_CELL[slice.tone]}
            />
          </div>
        )}

        {!visibleStories.length && <p className="rounded-2xl border border-slate-900/[0.07] bg-white p-10 text-center text-sm text-slate-500 shadow-sm">No stories match these filters. Clear filters to see the full map.</p>}

        <footer className="rounded-2xl border border-slate-900/[0.07] bg-white p-5 text-sm shadow-sm">
          <h3 className="font-bold tracking-tight">How to judge</h3>
          <ul className="mt-2 grid gap-2 leading-relaxed text-slate-500 md:grid-cols-3">
            <li className="rounded-xl bg-slate-50 p-3"><span className="font-bold text-slate-700">A wins if…</span> the full map feels calmer and you can scan a row without status pills shouting.</li>
            <li className="rounded-xl bg-slate-50 p-3"><span className="font-bold text-slate-700">B wins if…</span> blockers, ready work and outlines pop before titles do — triage gets faster.</li>
            <li className="rounded-xl bg-slate-50 p-3"><span className="font-bold text-slate-700">C wins if…</span> you open fewer specs because the why and the checks are already on the card.</li>
          </ul>
        </footer>
      </main>
    </div>
  );
}
