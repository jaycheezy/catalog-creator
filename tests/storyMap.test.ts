import { describe, expect, it } from 'vitest';
import { compileStoryMap, readStoryMap } from '../scripts/story-map-content.mjs';
import { createHandoff, isReady, unmetDependencies, relatedNotes, sortNotes, type ImplementationNote, type Story, type Slice } from '../src/story-map/model';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { SpecMarkdown } from '../src/components/story-map/SpecMarkdown';

const frontmatter = (data: object, body: string) => `---\n${Object.entries(data).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join('\n')}\n---\n${body}`;
const slice = { path: 'docs/slices/example/index.md', source: frontmatter({ id: 'example', title: 'Example', description: 'An outcome', order: 0, tone: 'blue' }, '# Example') };
function file(id = 'one', overrides = {}, body = '') {
  return { path: `docs/slices/example/${id}.md`, source: frontmatter({ id, title: id, slice: 'example', step: 'design', status: 'ready', implementation: 'specified', effort: 'M', order: 0, tags: [], dependsOn: [], value: 'Saves you time by handling this step automatically, so you can focus on selling.', ...overrides }, body || `# ${id}\n\n## Summary\n\nCard summary.\n\n## Acceptance criteria\n\n- First criterion\n  continued on another line.\n- Second criterion\n\n## Scope\n\nDraft only.\n\n## Implementation guidance\n\nReuse the controller.\n\n## Interfaces\n\nPreserve IDs.\n\n## Validation\n\nVerify stale writes.\n\n## Completion handoff\n\nReport evidence.\n`) };
}
describe('Markdown story map', () => {
  it('derives the card from the same Markdown and supports criterion continuation lines', () => {
    const result = compileStoryMap([slice, file()]);
    expect(result.stories[0].description).toBe('Card summary.');
    expect(result.stories[0].acceptance).toEqual(['First criterion continued on another line.', 'Second criterion']);
    expect(result.stories[0].body).toContain('Reuse the controller.');
  });
  it('rejects unknown dependencies, cycles, duplicate IDs, malformed metadata and missing slice indexes', () => {
    expect(() => compileStoryMap([slice, file('one', { dependsOn: ['missing'] })])).toThrow('unknown dependency');
    expect(() => compileStoryMap([slice, file('one', { dependsOn: ['two'] }), file('two', { dependsOn: ['one'] })])).toThrow('cycle');
    expect(() => compileStoryMap([slice, file(), file()])).toThrow('Duplicate story');
    expect(() => compileStoryMap([slice, file('one', { status: 'todo' })])).toThrow('invalid status');
    expect(() => compileStoryMap([file()])).toThrow('missing slice');
    expect(() => compileStoryMap([{ ...slice, source: slice.source.replace('---\n', '---js\n') }])).toThrow('YAML frontmatter');
  });
  it('rejects ready outlines and specified stories missing handoff sections', () => {
    expect(() => compileStoryMap([slice, file('one', { implementation: 'outline' })])).toThrow('ready story');
    const incomplete = file(); incomplete.source = incomplete.source.split('## Validation')[0];
    expect(() => compileStoryMap([slice, incomplete])).toThrow('missing Validation');
  });
  it('requires a plain-language value explanation on every story', () => {
    const result = compileStoryMap([slice, file()]);
    expect((result.stories as Story[])[0].value).toContain('Saves you time');
    expect(() => compileStoryMap([slice, file('one', { value: '' })])).toThrow('value must be');
    expect(() => compileStoryMap([slice, file('one', { value: 'Too short' })])).toThrow('value must be');
  });
  it('gates assignment and makes unfinished dependencies explicit in the handoff', () => {
    const result = compileStoryMap([slice, file('one', { dependsOn: ['two'] }), file('two', { status: 'in-review' })]);
    const stories = result.stories as Story[];
    const current = stories[0];
    expect(isReady(current, stories)).toBe(false);
    expect(unmetDependencies(current, stories)).toEqual(['two']);
    expect(createHandoff(current, result.slices[0] as Slice, stories)).toContain('Review readiness for');
    expect(createHandoff(current, result.slices[0] as Slice, stories)).toContain('docs/slices/example/two.md');
    stories[1].status = 'done';
    expect(isReady(current, stories)).toBe(true);
    expect(createHandoff(current, result.slices[0] as Slice, stories)).toMatch(/^Implement story one/);
    current.status = 'done';
    expect(createHandoff(current, result.slices[0] as Slice, stories)).toContain('not currently ready');
  });
  it('validates real migrated content and all seven detailed agent stories', () => {
    const catalog = readStoryMap();
    const realStories = catalog.stories as Story[];
    const agentStories = realStories.filter(story => story.slice === 'agent-assisted-workspace');
    expect(agentStories).toHaveLength(7);
    expect(agentStories.every(story => story.implementation === 'specified')).toBe(true);
    expect(realStories.some(story => story.id === 'c-reliable-durable-saves' && story.status === 'done')).toBe(true);
  });
  it('renders GFM and relative spec links without executing HTML or unsafe URLs', () => {
    const html = renderToStaticMarkup(createElement(SpecMarkdown, {
      sourcePath: 'docs/slices/agent-assisted-workspace/A1-browser-compatibility.md',
      body: '[Slice](index.md)\n\n| Tool | Use |\n| --- | --- |\n| context | Read |\n\n<script>alert(1)</script>\n\n[bad](javascript:alert%281%29)',
    }));
    expect(html).toContain('href="/story-map/specs/agent-assisted-workspace"');
    expect(html).toContain('<table>');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('href="javascript:');
  });
});


function noteFile(id = 'note-one', overrides = {}) {
  return { path: `docs/slices/example/notes/${id}.md`, source: frontmatter({ id, title: id, type: 'finding', status: 'open', author: 'test-agent', updated: '2026-09-05', affects: [], ...overrides }, '## Summary\n\nA shared finding.\n\n## Evidence\n\nObserved in code.\n\n## Impact\n\nShared contract.\n\n## Next action\n\nUpdate the spec.\n') };
}
describe('Implementation notes', () => {
  it('reads notes separately from stories and validates their references', () => {
    const result = compileStoryMap([slice, file(), noteFile('finding', { story: 'one' })]);
    expect(result.stories).toHaveLength(1);
    expect(result.notes).toHaveLength(1);
    expect(result.notes[0].summary).toBe('A shared finding.');
    expect(() => compileStoryMap([slice, file(), noteFile('bad', { affects: ['missing'] })])).toThrow('unknown note story');
    expect(() => compileStoryMap([slice, file(), noteFile(), noteFile()])).toThrow('Duplicate note id');
    expect(() => compileStoryMap([slice, noteFile('bad', { type: 'comment' })])).toThrow('invalid note type');
    expect(() => compileStoryMap([slice, noteFile('bad', { status: 'done' })])).toThrow('invalid note status');
    expect(() => compileStoryMap([slice, noteFile('bad', { updated: '2026-02-30' })])).toThrow('quoted ISO date');
    const incomplete = noteFile(); incomplete.source = incomplete.source.split('## Next action')[0];
    expect(() => compileStoryMap([slice, incomplete])).toThrow('missing Next action');
    expect(() => compileStoryMap([slice, file('notes')])).toThrow('reserved story slug');
  });
  it('includes originating, affected and slice-wide notes, sorting open blockers first', () => {
    const result = compileStoryMap([slice, file(), file('two'), noteFile('global'), noteFile('blocker', { story: 'one', type: 'blocker', updated: '2026-09-01' }), noteFile('affected', { affects: ['one'] }), noteFile('unrelated', { story: 'two' }), noteFile('old', { status: 'resolved', type: 'blocker' })]);
    const notes = result.notes as ImplementationNote[];
    const stories = result.stories as Story[];
    expect(relatedNotes(stories[0], notes).map(note => note.id)).toEqual(['blocker', 'affected', 'global', 'old']);
    expect(sortNotes(notes)[0].id).toBe('blocker');
    const handoff = createHandoff(stories[0], result.slices[0] as Slice, stories, notes);
    expect(handoff).toContain('notes/blocker.md');
    expect(handoff).not.toContain('notes/unrelated.md');
    expect(handoff).toContain('Notes do not override');
    expect(handoff).toContain('recheck before changing shared interfaces');
    expect(isReady(stories[0], stories)).toBe(true); // Notes never mutate recorded status/readiness.
  });
  it('discovers real nested notes and renders links between notes and specs', () => {
    const result = readStoryMap();
    expect(result.notes.some(note => note.path.endsWith('notes/2026-09-05-save-publication-boundary.md'))).toBe(true);
    const html = renderToStaticMarkup(createElement(SpecMarkdown, { sourcePath: 'docs/slices/agent-assisted-workspace/index.md', body: '[Finding](notes/2026-09-05-save-publication-boundary.md)' }));
    expect(html).toContain('href="/story-map/specs/agent-assisted-workspace/notes/2026-09-05-save-publication-boundary"');
  });
});
