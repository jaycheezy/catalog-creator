import { notFound } from 'next/navigation';
import { StoryMap } from '@/components/story-map/StoryMap';
import { slices, stories } from '@/story-map/data';
// Internal planning tool: served in local dev only, 404s in production builds.
export default function StoryMapPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <StoryMap slices={slices.map(slice => ({ ...slice, body: '' }))} stories={stories.map(story => ({ ...story, body: '' }))} />;
}
