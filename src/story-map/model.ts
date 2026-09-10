export type StoryStatus = 'proposed' | 'ready' | 'in-progress' | 'in-review' | 'done' | 'wont-do';
export type Story = {
  id: string; slice: string; slug: string; title: string; step: string;
  status: StoryStatus; effort: string; order: number; tags: string[];
  dependsOn: string[]; implementation: 'outline' | 'specified';
  value: string;
  path: string; body: string; description: string; acceptance: string[]; progress: string;
};
export type Slice = {
  id: string; title: string; description: string; order: number;
  tone: 'green' | 'blue' | 'violet' | 'amber' | 'zinc'; path: string; body: string;
};
export const statusLabels: Record<StoryStatus, string> = {
  proposed: 'Proposed', ready: 'Ready', 'in-progress': 'In progress', 'in-review': 'In review', done: 'Done', 'wont-do': "Won't do",
};
export function storyUrl(story: Pick<Story, 'slice' | 'slug'>) {
  return `/story-map/specs/${story.slice}/${story.slug}`;
}
export function sliceUrl(slice: Pick<Slice, 'id'>) { return `/story-map/specs/${slice.id}`; }
export function unmetDependencies(story: Story, stories: Story[]) {
  return story.dependsOn.filter(id => stories.find(item => item.id === id)?.status !== 'done');
}
export function isReady(story: Story, stories: Story[]) {
  return story.status === 'ready' && story.implementation === 'specified' && unmetDependencies(story, stories).length === 0;
}
export function createHandoff(story: Story, slice: Slice, stories: Story[], notes: ImplementationNote[] = []) {
  const blocked = unmetDependencies(story, stories);
  const eligible = isReady(story, stories) || (story.status === 'in-progress' && !blocked.length && story.implementation === 'specified');
  return [
    `${eligible ? 'Implement' : 'Review readiness for'} story ${story.id}: ${story.title}.`,
    '',
    'Read AGENTS.md and any applicable repository instructions first.',
    `Read the slice spec: ${slice.path}`,
    `Read the story spec: ${story.path}`,
    `Read shared notes in docs/slices/${slice.id}/notes/ before starting and recheck before changing shared interfaces.`,
    ...relatedNotes(story, notes).map(note => `- ${note.type} / ${note.status}: ${note.title}; ${note.path}`),
    'Resolve any relevant open blocker before dependent work. Notes do not override the implementation spec; proposals are not settled decisions.',
    `Recorded status: ${statusLabels[story.status]}. Implementation spec: ${story.implementation}.`,
    '',
    story.dependsOn.length ? 'Dependencies (verify their current implementation and contracts):\n' + story.dependsOn.map(id => {
      const dependency = stories.find(item => item.id === id);
      return `- ${id}: ${dependency?.status ?? 'missing'}${dependency ? `; ${dependency.path}` : ''}`;
    }).join('\n') : 'No prerequisite stories are recorded. Verify the repository assumptions in the spec.',
    blocked.length ? `Unfinished dependencies: ${blocked.join(', ')}. Do not bypass them or implement prerequisites as hidden scope.` : '',
    !eligible ? 'This story is not currently ready for a new implementation assignment. Resolve readiness or review the existing work before starting implementation.' : 'Implement only this story’s scope, reusing the shared contracts. Preserve unrelated work and coordinate changes to shared interfaces.',
    '',
    'Validate every acceptance criterion with the specified checks and concrete evidence. Report changed files, decisions, check results, remaining limitations and follow-ups.',
    'Record cross-story findings, proposals, decisions, blockers and handoffs as separate Markdown files in the slice notes/ directory using docs/templates/implementation-note.md. Keep story-specific work in Progress. Update the spec when a decision changes its contract, and link the explanatory note.',
    'Keep the Markdown status and Progress section current. Move completed implementation to in-review; do not claim done without the required review and evidence.',
  ].filter(line => line !== undefined).join('\n');
}

export type ImplementationNote = {
  id: string; slice: string; slug: string; title: string;
  type: 'finding' | 'proposal' | 'decision' | 'blocker' | 'handoff';
  status: 'open' | 'resolved' | 'superseded'; author: string; updated: string;
  story?: string; affects: string[]; path: string; body: string; summary: string;
};
export function notesUrl(slice: Pick<Slice, 'id'>) { return `/story-map/specs/${slice.id}/notes`; }
export function noteUrl(note: ImplementationNote) { return `/story-map/specs/${note.slice}/notes/${note.slug}`; }
export function relatedNotes(story: Story, notes: ImplementationNote[]) {
  return sortNotes(notes.filter(note => note.story === story.id || note.affects.includes(story.id) || (note.slice === story.slice && !note.story && !note.affects.length)));
}
export function sortNotes(notes: ImplementationNote[]) {
  const priority = (note: ImplementationNote) => note.status === 'open' ? note.type === 'blocker' ? 0 : 1 : 2;
  return [...notes].sort((a,b) => priority(a) - priority(b) || b.updated.localeCompare(a.updated) || a.id.localeCompare(b.id));
}
