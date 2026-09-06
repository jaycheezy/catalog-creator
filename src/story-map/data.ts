import catalog from './generated.json';
import type { Slice, Story, ImplementationNote } from './model';
// Generated only after Markdown metadata and the dependency graph validate.
export const slices = catalog.slices as Slice[];
export const stories = catalog.stories as Story[];

export const notes = catalog.notes as ImplementationNote[];
