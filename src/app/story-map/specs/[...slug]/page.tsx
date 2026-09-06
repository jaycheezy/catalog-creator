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
    return <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white"><nav aria-label="Breadcrumb" className="mx-auto flex max-w-5xl flex-wrap gap-3 px-5 py-4 text-sm"><Link href="/story-map" className="underline">← Story map</Link><span>/</span><Link href={sliceUrl(slice)} className="underline">{slice.title}</Link><span>/</span><Link href={notesUrl(slice)} className="underline">Implementation notes</Link></nav></header>
      <main className="mx-auto max-w-5xl space-y-5 px-5 py-8">
        <section className="rounded-xl border border-zinc-200 bg-white p-6">
          <h1 className="text-2xl font-semibold">{note ? note.title : 'Implementation notes'}</h1>
          <p className="mt-2 text-sm text-zinc-600">Shared findings, proposals, decisions, blockers and handoffs. The implementation specs remain the source of truth for contracts.</p>
          <p className="mt-3 break-all font-mono text-xs text-zinc-500">{note ? note.path : `docs/slices/${slice.id}/notes/`}</p>
          {!note && <p className="mt-3 text-sm text-zinc-600">Agents add one file per note using <code>docs/templates/implementation-note.md</code>. Local development picks up valid changes automatically.</p>}
          {note && <>
            <p className="mt-4 text-sm capitalize">{note.type} · {note.status} · {note.author} · Updated {note.updated}</p>
            {note.type === 'proposal' && <p className="mt-3 rounded bg-amber-50 p-3 text-sm text-amber-900">This is a proposal, not a settled implementation contract.</p>}
            <ul className="mt-4 space-y-2 text-sm">{[...new Set([...(note.story ? [note.story] : []), ...note.affects])].map(id => { const target = stories.find(item => item.id === id)!; return <li key={id}><span className="text-zinc-500">{id === note.story ? 'Origin story: ' : 'Affects: '}</span><Link href={storyUrl(target)} className="text-violet-800 underline">{target.title}</Link></li>; })}</ul>
            {!note.story && !note.affects.length && <p className="mt-3 text-sm text-zinc-500">Applies to all stories in this slice.</p>}
          </>}
        </section>
        {note ? <article className="rounded-xl border border-zinc-200 bg-white p-6 sm:p-9"><SpecMarkdown body={note.body} sourcePath={note.path} /></article> : <NotesBoard notes={sliceNotes.map(item => ({ ...item, body: '' }))} />}
      </main>
    </div>;
  }
  const story = slug.length === 2 ? stories.find(item => item.slice === slice.id && item.slug === slug[1]) : undefined;
  if (slug.length === 2 && !story) notFound();
  const document = story ?? slice;
  const blocked = story ? unmetDependencies(story, stories) : [];
  return <div className="min-h-screen bg-zinc-50 text-zinc-900">
    <header className="border-b bg-white"><nav aria-label="Breadcrumb" className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-5 py-4 text-sm"><Link href="/story-map" className="font-medium underline underline-offset-4">← Story map</Link><span className="text-zinc-400">/</span>{story ? <Link href={sliceUrl(slice)} className="underline">{slice.title}</Link> : <span>{slice.title}</span>}{story && <><span className="text-zinc-400">/</span><span>{story.id}</span></>}</nav></header>
    <main className="mx-auto max-w-5xl space-y-6 px-5 py-8">
      <section className="rounded-xl border bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-violet-700">{story ? 'Implementation spec' : 'Slice architecture'}</p>
        <p className="mt-2 break-all font-mono text-xs text-zinc-500">{document.path}</p>
        {story && <>
          <div className="my-4 flex flex-wrap gap-2 text-xs"><span className="rounded bg-zinc-100 px-2 py-1">{statusLabels[story.status]}</span><span className="rounded bg-zinc-100 px-2 py-1">Effort {story.effort}</span><span className="rounded bg-violet-50 px-2 py-1 text-violet-800">{isReady(story, stories) ? 'Ready to assign' : story.implementation === 'outline' ? 'Outline — needs implementation detail' : blocked.length ? 'Dependencies unfinished' : 'Implementation specified'}</span></div>
          <div className="mb-4 rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm"><p className="text-[11px] font-semibold uppercase tracking-widest text-violet-700">Why this matters</p><p className="mt-1 leading-relaxed text-zinc-700">{story.value}</p></div>
          {story.dependsOn.length > 0 && <div className="mb-4 text-sm"><p className="mb-2 font-medium">Prerequisite stories</p><ul className="space-y-1">{story.dependsOn.map(id => { const dependency = stories.find(item => item.id === id)!; return <li key={id}><Link href={storyUrl(dependency)} className="text-violet-800 underline">{dependency.title}</Link><span className="ml-2 text-xs text-zinc-500">{statusLabels[dependency.status]}</span></li>; })}</ul></div>}
          <CopyHandoff text={createHandoff(story, slice, stories, notes)} />
          {!isReady(story, stories) && story.status !== 'in-progress' && <p className="mt-2 text-xs text-zinc-500">The handoff includes this story’s current readiness and prerequisites.</p>}
        </>}
      </section>
      <section className="rounded-xl border border-zinc-200 bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">{story ? 'Related implementation notes' : 'Shared implementation notes'}</h2><Link href={notesUrl(slice)} className="text-sm text-violet-800 underline">Open slice noteboard →</Link></div><NotesBoard compact notes={(story ? relatedNotes(story, notes) : notes.filter(item => item.slice === slice.id)).map(item => ({ ...item, body: '' }))} /></section>
      <article className="rounded-xl border bg-white p-5 sm:p-9"><SpecMarkdown body={document.body} sourcePath={document.path} /></article>
      {!story && <section className="rounded-xl border bg-white p-5"><h2 className="text-lg font-semibold">Stories in this slice</h2><ul className="mt-4 divide-y">{stories.filter(item => item.slice === slice.id).map(item => <li key={item.id} className="flex flex-wrap justify-between gap-2 py-3"><Link href={storyUrl(item)} className="text-sm text-violet-800 underline">{item.title}</Link><span className="text-xs text-zinc-500">{statusLabels[item.status]} · {item.implementation === 'outline' ? 'Outline' : 'Specified'}</span></li>)}</ul></section>}
      <Link href={story ? `/story-map#${story.id}` : '/story-map'} className="inline-block text-sm underline">← Back to story map</Link>
    </main>
  </div>;
}
