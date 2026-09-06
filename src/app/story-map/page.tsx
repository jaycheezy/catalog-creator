import { StoryMap } from '@/components/story-map/StoryMap';
import { slices, stories } from '@/story-map/data';
export default function StoryMapPage() {
  return <StoryMap slices={slices.map(slice => ({ ...slice, body: '' }))} stories={stories.map(story => ({ ...story, body: '' }))} />;
}
