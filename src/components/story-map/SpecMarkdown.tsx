import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { slices, stories, notes } from '@/story-map/data';
import { sliceUrl, storyUrl, noteUrl } from '@/story-map/model';

function resolveLink(href: string, sourcePath: string) {
  if (href.startsWith('#') || /^(https?:|mailto:)/i.test(href)) return href;
  const url = new URL(href, `https://repository.local/${sourcePath}`);
  const target = decodeURIComponent(url.pathname.slice(1));
  const story = stories.find(item => item.path === target);
  const slice = slices.find(item => item.path === target);
  const note = notes.find(item => item.path === target);
  return note ? noteUrl(note) + url.hash : story ? storyUrl(story) + url.hash : slice ? sliceUrl(slice) + url.hash : undefined;
}
export function SpecMarkdown({ body, sourcePath }: { body: string; sourcePath: string }) {
  return <div className="spec-markdown"><Markdown remarkPlugins={[remarkGfm]} skipHtml components={{
    a: ({ href = '', children }) => { const resolved = resolveLink(href, sourcePath); return resolved ? <a href={resolved}>{children}</a> : <span>{children} <code>({href})</code></span>; },
    img: ({ alt }) => <span>{alt || 'Image reference'}</span>,
    table: ({ children }) => <div className="overflow-x-auto"><table>{children}</table></div>,
  }}>{body}</Markdown></div>;
}
