import type { ImplementationNote, Slice, Story } from "../src/story-map/model";

export type StoryMapFile = { path: string; source: string };
export type StoryMapCatalog = {
  slices: Slice[];
  stories: Story[];
  notes: ImplementationNote[];
};
export type StoryMove = { id: string; slice: string; step: string };
export type StoryMoveContext = { steps?: string[]; sliceIds?: string[] };
export type StoryMoveResult = {
  files: StoryMapFile[];
  path: string;
  prevPath: string;
  changed: boolean;
};
export function compileStoryMap(files: StoryMapFile[]): StoryMapCatalog;
export function readStoryMapFiles(root?: string): StoryMapFile[];
export function readStoryMap(root?: string): StoryMapCatalog;
export function generateStoryMap(root?: string): StoryMapCatalog;
export function applyStoryMove(files: StoryMapFile[], move: StoryMove, context?: StoryMoveContext): StoryMoveResult;
export type StoryStatusChange = { id: string; status: string };
export type StoryStatusResult = {
  files: StoryMapFile[];
  path: string;
  changed: boolean;
};
export function applyStoryStatus(files: StoryMapFile[], change: StoryStatusChange): StoryStatusResult;
