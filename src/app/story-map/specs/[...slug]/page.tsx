import Link from 'next/link';
import { notFound } from 'next/navigation';
import { slices, stories, notes } from '@/story-map/data';
import { createHandoff, isReady, sliceUrl, statusLabels, storyUrl, unmetDependencies, notesUrl, relatedNotes } from '@/story-map/model';
import { CopyHandoff } from '@/components/story-map/CopyHandoff';
import { SpecMarkdown } from '@/components/story-map/SpecMarkdown';
import { NotesBoard } from '@/components/story-map/NotesBoard';
import './spec.css';

export function generateStaticParams() {
  return [...slices.map(slice => ({ slug: [slice.id] })), ...stories.map(story => ({ slug: [story.slice, story.slug] })), ...slices.map(slice => ({ slug: [slice.id, 'notes'] })), ...notes.map(note => ({ slug: [note.slice, 'notes', note.slug] }))];
}
export default async function SpecPage({ params }: { params: Promise<{ slug: string[] }> }) {
  // Internal planning tool: served in local dev only, 404s in production builds.
  if (process.env.NODE_ENV === 'production') notFound();
  const { slug } = await params;
  const slice = slices.find(item => item.id === slug[0]);
  if (!slice || slug.length > 3) notFound();
  const isNotes = slug[1] === 'notes';
  const note = isNotes && slug.length === 3 ? notes.find(item => item.slice === slice.id && item.slug === slug[2]) : undefined;
  if ((slug.length === 3 && !note) || (slug.length === 3 && !isNotes)) notFound();
  if (isNotes) {
    const sliceNotes = notes.filter(item => item.slice === slice.id);
    return <div className="min-h-screen bg-[#f6f9fc] text-slate-900 antialiased">
      <header className="sticky top-0 z-30 border-b border-slate-900/10 bg-white/80 backdrop-blur-md"><nav aria-label="Breadcrumb" className="mx-auto flex max-w-5xl flex-wrap items-center gap-2.5 px-5 py-3 text-sm"><Link href="/story-map" className="font-semibold text-slate-500 transition hover:text-slate-950">← Story map</Link><span className="text-slate-300">/</span><Link href={sliceUrl(slice)} className="font-medium text-slate-500 transition hover:text-slate-950">{slice.title}</Link><span className="text-slate-300">/</span><Link href={notesUrl(slice)} className="font-medium text-slate-950">Implementation notes</Link></nav></header>
      <main className="mx-auto max-w-5xl space-y-5 px-5 py-8">
        <section className="rounded-2xl border border-slate-900/[0.07] bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.05),0_8px_24px_-12px_rgba(16,24,40,0.12)] sm:p-8">
          <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">Noteboard</p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight sm:text-3xl">{note ? note.title : 'Implementation notes'}</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">Shared findings, proposals, decisions, blockers and handoffs. The implementation specs remain the source of truth for contracts.</p>
          <p className="mt-3 inline-block break-all rounded-lg bg-slate-100 px-2 py-1 font-mono text-xs text-slate-500">{note ? note.path : `docs/slices/${slice.id}/notes/`}</p>
          {!note && <p className="mt-3 text-sm text-slate-500">Agents add one file per note using <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs">docs/templates/implementation-note.md</code>. Local development picks up valid changes automatically.</p>}
          {note && <>
            <p className="mt-4 text-sm capitalize text-slate-500">{note.type} · {note.status} · {note.author} · Updated {note.updated}</p>
            {note.type === 'proposal' && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-900">This is a proposal, not a settled implementation contract.</p>}
            <ul className="mt-4 space-y-2 text-sm">{[...new Set([...(note.story ? [note.story] : []), ...note.affects])].map(id => { const target = stories.find(item => item.id === id)!; return <li key={id}><span className="text-slate-400">{id === note.story ? 'Origin story: ' : 'Affects: '}</span><Link href={storyUrl(target)} className="font-semibold text-indigo-700 hover:text-indigo-900 hover:underline">{target.title}</Link></li>; })}</ul>
            {!note.story && !note.affects.length && <p className="mt-3 text-sm text-slate-400">Applies to all stories in this slice.</p>}
          </>}
        </section>
        {note ? <article className="rounded-2xl border border-slate-900/[0.07] bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.05)] sm:p-9"><SpecMarkdown body={note.body} sourcePath={note.path} /></article> : <div className="rounded-2xl border border-slate-900/[0.07] bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.05)]"><NotesBoard notes={sliceNotes.map(item => ({ ...item, body: '' }))} /></div>}
      </main>
    </div>;
  }
  const story = slug.length === 2 ? stories.find(item => item.slice === slice.id && item.slug === slug[1]) : undefined;
  if (slug.length === 2 && !story) notFound();
  const document = story ?? slice;
  const blocked = story ? unmetDependencies(story, stories) : [];
  return <div className="min-h-screen bg-[#f6f9fc] text-slate-900 antialiased">
    <header className="sticky top-0 z-30 border-b border-slate-900/10 bg-white/80 backdrop-blur-md"><nav aria-label="Breadcrumb" className="mx-auto flex max-w-5xl flex-wrap items-center gap-2.5 px-5 py-3 text-sm"><Link href="/story-map" className="font-semibold text-slate-500 transition hover:text-slate-950">← Story map</Link><span className="text-slate-300">/</span>{story ? <Link href={sliceUrl(slice)} className="font-medium text-slate-500 transition hover:text-slate-950">{slice.title}</Link> : <span className="font-medium text-slate-950">{slice.title}</span>}{story && <><span className="text-slate-300">/</span><code className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-600">{story.id}</code></>}</nav></header>
    <main className="mx-auto max-w-5xl space-y-5 px-5 py-8">
      <section className="rounded-2xl border border-slate-900/[0.07] bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.05),0_8px_24px_-12px_rgba(16,24,40,0.12)]">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">{story ? 'Implementation spec' : 'Slice architecture'}</p>
        <p className="mt-2 inline-block break-all rounded-lg bg-slate-100 px-2 py-1 font-mono text-xs text-slate-500">{document.path}</p>
        {story && <>
          <div className="my-4 flex flex-wrap gap-1.5 text-xs"><span className="rounded-md bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">{statusLabels[story.status]}</span><span className="rounded-md bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">Effort {story.effort}</span><span className={`rounded-md px-2.5 py-1 font-semibold ring-1 ring-inset ${isReady(story, stories) ? 'bg-indigo-50 text-indigo-700 ring-indigo-600/20' : story.status === 'wont-do' ? 'bg-slate-100 text-slate-500 ring-slate-500/10' : 'bg-amber-50 text-amber-800 ring-amber-600/20'}`}>{story.status === 'wont-do' ? "Won't do — dropped scope" : isReady(story, stories) ? 'Ready to assign' : story.implementation === 'outline' ? 'Outline — needs implementation detail' : blocked.length ? 'Dependencies unfinished' : 'Implementation specified'}</span></div>
          <div className="mb-4 rounded-xl border border-indigo-200/70 bg-indigo-50/60 p-4 text-sm"><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-700">Why this matters</p><p className="mt-1 leading-relaxed text-slate-600">{story.value}</p></div>
          {story.dependsOn.length > 0 && <div className="mb-4 text-sm"><p className="mb-2 font-bold text-slate-900">Prerequisite stories</p><ul className="space-y-1.5">{story.dependsOn.map(id => { const dependency = stories.find(item => item.id === id)!; return <li key={id}><Link href={storyUrl(dependency)} className="font-medium text-indigo-700 hover:text-indigo-900 hover:underline">{dependency.title}</Link><span className="ml-2 rounded-md bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">{statusLabels[dependency.status]}</span></li>; })}</ul></div>}
          <CopyHandoff text={createHandoff(story, slice, stories, notes)} />
          {!isReady(story, stories) && story.status !== 'in-progress' && <p className="mt-2 text-xs text-slate-400">The handoff includes this story’s current readiness and prerequisites.</p>}
        </>}
      </section>
      <section className="rounded-2xl border border-slate-900/[0.07] bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.05)]"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold tracking-tight">{story ? 'Related implementation notes' : 'Shared implementation notes'}</h2><Link href={notesUrl(slice)} className="text-sm font-semibold text-indigo-700 hover:text-indigo-900 hover:underline">Open slice noteboard →</Link></div><NotesBoard compact notes={(story ? relatedNotes(story, notes) : notes.filter(item => item.slice === slice.id)).map(item => ({ ...item, body: '' }))} /></section>
      <article className="rounded-2xl border border-slate-900/[0.07] bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.05)] sm:p-9"><SpecMarkdown body={document.body} sourcePath={document.path} /></article>
      {!story && <section className="rounded-2xl border border-slate-900/[0.07] bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.05)]"><h2 className="text-lg font-bold tracking-tight">Stories in this slice</h2><ul className="mt-2 divide-y divide-slate-100">{stories.filter(item => item.slice === slice.id).map(item => <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-3"><Link href={storyUrl(item)} className="text-sm font-medium text-indigo-700 hover:text-indigo-900 hover:underline">{item.title}</Link><span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{statusLabels[item.status]} · {item.implementation === 'outline' ? 'Outline' : 'Specified'}</span></li>)}</ul></section>}
      <Link href={story ? `/story-map#${story.id}` : '/story-map'} className="inline-block text-sm font-semibold text-slate-500 transition hover:text-slate-950">← Back to story map</Link>
    </main>
  </div>;
}
