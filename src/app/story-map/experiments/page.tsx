import { notFound } from 'next/navigation';
import { ExperimentsLab } from '@/components/story-map/ExperimentsLab';
import { slices, stories } from '@/story-map/data';

// Internal design lab: served in local dev only, 404s in production builds.
export default function StoryMapExperimentsPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <ExperimentsLab
      slices={slices.map(slice => ({ ...slice, body: '' }))}
      stories={stories.map(story => ({ ...story, body: '' }))}
    />
  );
}
