import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

const statuses = ['proposed', 'ready', 'in-progress', 'in-review', 'done', 'wont-do'];
const steps = ['connect', 'validate', 'design', 'variants', 'feed', 'publish', 'test'];
const requiredSections = ['Scope', 'Implementation guidance', 'Interfaces', 'Validation', 'Completion handoff'];
function assert(value, message) { if (!value) throw new Error(message); }
function text(value) { return typeof value === 'string' && value.trim().length > 0; }
function section(body, title) {
  // Fenced examples must not accidentally become card metadata.
  const clean = body.replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1\s*$/gm, '');
  const heading = `## ${title}`;
  const lines = clean.split('\n');
  const start = lines.findIndex(line => line.trim() === heading);
  if (start < 0) return '';
  const end = lines.findIndex((line, i) => i > start && /^#{1,2} /.test(line));
  return lines.slice(start + 1, end < 0 ? undefined : end).join('\n').trim();
}
export function compileStoryMap(files) {
  const slices = [], stories = [], notes = [];
  for (const file of files) {
    assert(/^---\r?\n/.test(file.source), `${file.path}: YAML frontmatter is required`);
    const { data, content } = matter(file.source);
    const label = file.path;
    assert(text(data.id) && /^[a-z0-9-]+$/.test(data.id), `${label}: invalid id`);
    assert(text(data.title), `${label}: missing title`);
    const segments = file.path.split('/');
    const isNote = segments.length === 5 && segments[3] === 'notes';
    assert((segments.length === 4 || isNote) && segments[0] === 'docs' && segments[1] === 'slices', `${label}: invalid path`);
    const slug = segments[2];
    assert(/^[a-z0-9-]+$/.test(slug) && /^[A-Za-z0-9-]+\.md$/.test(segments[isNote ? 4 : 3]), `${label}: invalid slug`);
    const common = { ...data, path: label, body: content.trim() };
    if (isNote) {
      assert(['finding', 'proposal', 'decision', 'blocker', 'handoff'].includes(data.type), `${label}: invalid note type`);
      assert(['open', 'resolved', 'superseded'].includes(data.status), `${label}: invalid note status`);
      assert(text(data.author), `${label}: missing note author`);
      assert(typeof data.updated === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.updated) && !Number.isNaN(Date.parse(data.updated)) && new Date(data.updated).toISOString().slice(0, 10) === data.updated, `${label}: updated must be a quoted ISO date`);
      assert(data.story === undefined || text(data.story), `${label}: invalid note story`);
      assert(Array.isArray(data.affects) && data.affects.every(text) && new Set(data.affects).size === data.affects.length, `${label}: invalid note affects`);
      for (const title of ['Summary', 'Evidence', 'Impact', 'Next action']) assert(text(section(content, title)), `${label}: missing ${title}`);
      notes.push({ ...common, slice: slug, slug: segments[4].slice(0, -3), summary: section(content, 'Summary') });
      continue;
    }
    assert(Number.isInteger(data.order) && data.order >= 0, `${label}: invalid order`);
    if (segments[3] === 'notes.md') throw new Error(`${label}: notes is a reserved story slug`);
    if (segments[3] === 'index.md') {
      assert(data.id === slug && text(data.description), `${label}: invalid slice metadata`);
      assert(['green', 'blue', 'violet', 'amber', 'zinc'].includes(data.tone), `${label}: invalid tone`);
      slices.push(common);
    } else {
      assert(data.slice === slug && steps.includes(data.step), `${label}: invalid slice or step`);
      assert(statuses.includes(data.status), `${label}: invalid status`);
      assert(['S', 'M', 'L', 'XL'].includes(data.effort), `${label}: invalid effort`);
      assert(['outline', 'specified'].includes(data.implementation), `${label}: invalid implementation maturity`);
      assert(text(data.value) && data.value.trim().length >= 20 && data.value.trim().length <= 400, `${label}: value must be a plain-language explanation (20-400 characters)`);
      for (const field of ['tags', 'dependsOn']) assert(Array.isArray(data[field]) && data[field].every(text) && new Set(data[field]).size === data[field].length, `${label}: invalid ${field}`);
      const description = section(content, 'Summary');
      const acceptanceText = section(content, 'Acceptance criteria');
      const acceptance = acceptanceText.split(/\n(?=- )/).filter(line => line.startsWith('- ')).map(line => line.slice(2).replace(/\n\s*/g, ' ').trim());
      assert(text(description), `${label}: missing Summary`);
      if (data.implementation === 'specified') {
        assert(acceptance.length > 0, `${label}: specified story needs acceptance criteria`);
        for (const title of requiredSections) assert(text(section(content, title)), `${label}: missing ${title}`);
      }
      assert(data.status !== 'ready' || data.implementation === 'specified', `${label}: ready story needs a specified implementation`);
      stories.push({ ...common, slug: segments[3].slice(0, -3), description, acceptance, progress: section(content, 'Progress') });
    }
  }
  const sliceIds = new Set(slices.map(s => s.id));
  assert(sliceIds.size === slices.length, 'Duplicate slice id');
  const byId = new Map(stories.map(s => [s.id, s]));
  assert(byId.size === stories.length, 'Duplicate story id');
  for (const story of stories) {
    assert(sliceIds.has(story.slice), `${story.path}: missing slice index`);
    for (const id of story.dependsOn) assert(byId.has(id), `${story.path}: unknown dependency ${id}`);
  }
  assert(new Set(notes.map(note => note.id)).size === notes.length, 'Duplicate note id');
  for (const note of notes) {
    assert(sliceIds.has(note.slice), `${note.path}: missing slice index`);
    for (const id of [...(note.story ? [note.story] : []), ...note.affects]) assert(byId.has(id), `${note.path}: unknown note story ${id}`);
  }
  const visiting = new Set(), visited = new Set();
  function visit(id) {
    assert(!visiting.has(id), `Dependency cycle at ${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of byId.get(id).dependsOn) visit(dependency);
    visiting.delete(id); visited.add(id);
  }
  for (const story of stories) visit(story.id);
  return { notes: notes.sort((a,b) => b.updated.localeCompare(a.updated) || a.id.localeCompare(b.id)), slices: slices.sort((a,b) => a.order-b.order || a.id.localeCompare(b.id)), stories: stories.sort((a,b) => a.order-b.order || a.id.localeCompare(b.id)) };
}
export function readStoryMapFiles(root = process.cwd()) {
  const directory = path.join(root, 'docs/slices');
  const files = [];
  for (const slice of fs.readdirSync(directory, { withFileTypes: true })) {
    if (!slice.isDirectory()) continue;
    const noteDirectory = path.join(directory, slice.name, 'notes');
    if (fs.existsSync(noteDirectory)) {
      for (const entry of fs.readdirSync(noteDirectory, { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
        const relative = `docs/slices/${slice.name}/notes/${entry.name}`;
        files.push({ path: relative, source: fs.readFileSync(path.join(root, relative), 'utf8') });
      }
    }
    for (const name of fs.readdirSync(path.join(directory, slice.name))) {
      if (!name.endsWith('.md')) continue;
      const relative = `docs/slices/${slice.name}/${name}`;
      files.push({ path: relative, source: fs.readFileSync(path.join(root, relative), 'utf8') });
    }
  }
  return files;
}
export function readStoryMap(root = process.cwd()) {
  return compileStoryMap(readStoryMapFiles(root));
}
function setFrontmatterField(source, field, value) {
  const lines = source.split('\n');
  if (lines[0].trim() !== '---') throw new Error('YAML frontmatter is required');
  const end = lines.findIndex((line, i) => i > 0 && line.trim() === '---');
  if (end < 0) throw new Error('YAML frontmatter is required');
  let found = false;
  for (let i = 1; i < end; i++) {
    if (new RegExp(`^${field}:`).test(lines[i])) { lines[i] = `${field}: "${value}"`; found = true; }
  }
  if (!found) throw new Error(`missing frontmatter field ${field}`);
  return lines.join('\n');
}
export function applyStoryMove(files, move, context = {}) {
  const { id, slice, step } = move;
  const steps = context.steps ?? ['connect', 'validate', 'design', 'variants', 'feed', 'publish', 'test'];
  const sliceIds = context.sliceIds ?? [...new Set(files.map(file => file.path.split('/')[2]).filter(Boolean))];
  if (!steps.includes(step)) throw new Error(`unknown step ${step}`);
  if (!sliceIds.includes(slice)) throw new Error(`unknown slice ${slice}`);
  const index = files.findIndex(file => {
    if (!/^docs\/slices\/[^/]+\/[^/]+\.md$/.test(file.path) || file.path.endsWith('/index.md') || file.path.endsWith('/notes.md')) return false;
    try { return matter(file.source).data.id === id; } catch { return false; }
  });
  if (index < 0) throw new Error(`unknown story ${id}`);
  const prevPath = files[index].path;
  const current = matter(files[index].source).data;
  if (current.slice === slice && current.step === step) return { files, path: prevPath, prevPath, changed: false };
  const filename = prevPath.split('/').pop();
  const nextPath = `docs/slices/${slice}/${filename}`;
  if (files.some((file, i) => i !== index && file.path === nextPath)) throw new Error(`${nextPath} already exists`);
  let source = setFrontmatterField(files[index].source, 'slice', slice);
  source = setFrontmatterField(source, 'step', step);
  const next = files.map((file, i) => i === index ? { path: nextPath, source } : file);
  compileStoryMap(next);
  return { files: next, path: nextPath, prevPath, changed: true };
}
export function findStoryFile(files, id) {
  const index = files.findIndex(file => {
    if (!/^docs\/slices\/[^/]+\/[^/]+\.md$/.test(file.path) || file.path.endsWith('/index.md') || file.path.endsWith('/notes.md')) return false;
    try { return matter(file.source).data.id === id; } catch { return false; }
  });
  if (index < 0) throw new Error(`unknown story ${id}`);
  return index;
}
export function applyStoryStatus(files, change) {
  const { id, status } = change;
  if (!statuses.includes(status)) throw new Error(`unknown status ${status}`);
  const index = findStoryFile(files, id);
  const current = matter(files[index].source).data;
  if (current.status === status) return { files, path: files[index].path, changed: false };
  const source = setFrontmatterField(files[index].source, 'status', status);
  const next = files.map((file, i) => i === index ? { path: file.path, source } : file);
  compileStoryMap(next);
  return { files: next, path: files[index].path, changed: true };
}
export function generateStoryMap(root = process.cwd()) {
  const catalog = readStoryMap(root);
  const destination = path.join(root, 'src/story-map/generated.json');
  const output = JSON.stringify(catalog, null, 2) + '\n';
  if (!fs.existsSync(destination) || fs.readFileSync(destination, 'utf8') !== output) fs.writeFileSync(destination, output);
  return catalog;
}
