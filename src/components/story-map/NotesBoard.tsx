'use client';
import { useState } from 'react';
import Link from 'next/link';
import { noteUrl, sortNotes, type ImplementationNote } from '@/story-map/model';

export function NotesBoard({ notes, compact = false }: { notes: ImplementationNote[]; compact?: boolean }) {
  const [type, setType] = useState('all');
  const [status, setStatus] = useState('all');
  const visible = sortNotes(notes).filter(note => (type === 'all' || note.type === type) && (status === 'all' || note.status === status));
  return <div>
    {!compact && <div className="my-4 flex flex-wrap items-center gap-4 text-sm">
      <label>Note type <select value={type} onChange={event => setType(event.target.value)} className="ml-2 rounded border border-zinc-300 bg-white p-2"><option value="all">All types</option>{['finding', 'proposal', 'decision', 'blocker', 'handoff'].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
      <label>Note status <select value={status} onChange={event => setStatus(event.target.value)} className="ml-2 rounded border border-zinc-300 bg-white p-2"><option value="all">All statuses</option>{['open', 'resolved', 'superseded'].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
      <span role="status" className="text-xs text-zinc-500">{visible.length} notes · open blockers first</span>
    </div>}
    {!visible.length && <p className="mt-3 text-sm text-zinc-500">{notes.length ? 'No notes match these filters.' : 'No implementation notes yet. Add a Markdown file using the note template to share a finding, decision or blocker.'}</p>}
    <ul className="mt-3 space-y-3">{visible.map(note => <li key={note.id} className={`rounded-lg border p-4 ${note.type === 'blocker' && note.status === 'open' ? 'border-amber-300 bg-amber-50' : 'border-zinc-200 bg-white'}`}>
      <p className="mb-2 flex flex-wrap gap-2 text-xs"><span className="rounded bg-zinc-100 px-2 py-1 capitalize">{note.type}</span><span className="rounded bg-zinc-100 px-2 py-1 capitalize">{note.status}</span></p>
      <Link href={noteUrl(note)} className="font-medium text-violet-800 underline underline-offset-4">{note.title}</Link>
      <p className="mt-2 text-sm leading-relaxed text-zinc-600">{note.summary}</p>
      <p className="mt-3 text-xs text-zinc-500">{note.author} · Updated {note.updated}</p>
    </li>)}</ul>
  </div>;
}
