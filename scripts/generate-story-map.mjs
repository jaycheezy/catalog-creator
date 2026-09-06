import { generateStoryMap } from './story-map-content.mjs';
const catalog = generateStoryMap();
console.log(`Story map: ${catalog.stories.length} stories across ${catalog.slices.length} slices, ${catalog.notes.length} notes validated.`);
