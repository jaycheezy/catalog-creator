# Authoring implementation-ready stories

The story map reads `docs/slices/<slice-id>/index.md` and sibling story Markdown files. These files are the shared source of truth for scope, order, status, dependencies and acceptance criteria. The UI provides filters and reading/handoff tools; change the Markdown to reprioritize or update status. Browser-local card edits from the previous map can be exported from the migration notice, but are never silently merged into shared status.

## Add a slice

Copy `docs/templates/slice.md` into `docs/slices/<slice-id>/index.md`. Give it a unique lowercase hyphenated ID matching the directory name. Set its title, description, order and tone. Describe the user outcome, scope boundaries, shared contracts, sequence and release evidence. Keep shared architecture here, and implementation details in individual stories.

## Add a story

Copy `docs/templates/story.md` into the slice directory with a descriptive filename. Set its unique ID, matching slice ID, journey step, status, effort, order, tags, dependencies and implementation maturity. Filenames become spec URLs; IDs are stable references used by dependency graphs. Rename deliberately and update Markdown links when needed. Every story also needs a `value` frontmatter field: one or two plain, non-technical sentences (20-400 characters) explaining what changes for the shop owner or shopper once the story is done. It appears behind the ⓘ icon on story cards.

- Journey steps: `connect`, `validate`, `design`, `variants`, `feed`, `publish`, `test`.
- Status: `proposed`, `ready`, `in-progress`, `in-review`, `done`, `wont-do` (dropped scope — dependents still treat it as an unfinished prerequisite).
- Implementation: `outline` or `specified`.
- Effort: `S`, `M`, `L`, `XL`.
- Slice tones: `green`, `blue`, `violet`, `amber`, `zinc`.
- `order` is a nonnegative integer; equal values sort by ID.

Use ordinary YAML frontmatter. Summary and acceptance criteria come from the `## Summary` and `## Acceptance criteria` sections, so the card and spec cannot drift apart. Acceptance criteria must be top-level Markdown bullets, one observable criterion per bullet; continuation lines are supported. Keep the summary short, as it appears on the card. Optional `## Progress` records evidence and blockers. Markdown supports lists, tables, links and fenced code; raw HTML is disabled. Mermaid fences are displayed as source code, not executed diagrams. Relative links to other story/slice Markdown files resolve to their spec pages.

Only slice index and story files belong immediately inside each slice directory. Shared implementation notes belong in the nested `notes/` directory. Store other research, screenshots and supporting material in `docs/research/` or a separate evidence directory. The content validator treats every sibling `.md` file as a story.

## Readiness and assignment

1. Start as `proposed` with `implementation: outline` while the story is being refined.
2. Write Scope, Implementation guidance, Interfaces, Validation and Completion handoff sections. Set `implementation: specified` when these contain real instructions, not placeholders.
3. Review unresolved decisions and dependency contracts. Set `status: ready` only when the story is suitable for assignment. The map's Ready filter additionally requires all dependencies to be `done`.
4. Open the spec and copy the agent handoff. The handoff lists repository paths, prerequisite statuses and the expected completion report. An unfinished or outline story produces a readiness-review handoff rather than an unconditional implementation instruction.
5. The implementing agent updates status to `in-progress`, preserves unrelated changes, and records implementation/verification evidence under Progress.
6. Move to `in-review` when implementation and evidence are ready. Mark `done` after review against the acceptance criteria. The UI does not infer completion from a commit or successful test alone.

Dependencies are prerequisites, not just related links. Unknown IDs, duplicate IDs and cycles fail validation. Independent stories may be assigned concurrently only if they have compatible file/contract ownership. A story that depends on a shared controller should wait for that controller contract; do not ask separate agents to invent it independently.

## Move stories by drag and drop

Drag a card onto another step column or slice row to move it. In local dev (`npm run dev`) the move is saved to the story's Markdown file — the `step` frontmatter field, plus the `slice` field with the file relocated into the target slice directory — and the map revalidates before saving. Production builds are read-only, so a failed save reverts the card and reports the error. Story IDs never change, so dependencies and notes keep working.

## Development and delivery

`npm run dev` validates and bundles the Markdown, then watches `docs/slices` for changes. Valid edits refresh the generated data and Next.js view. Invalid edits are reported in the terminal and leave the last valid view in place until corrected.

`npm run story-map:check` validates content and regenerates `src/story-map/generated.json`. The file is ignored and must not be edited manually. Standard build, test, typecheck, preview and deploy scripts generate it automatically. If using Next.js directly or an external build command, run the content check first.

The story map is a local-dev-only tool: `/story-map` and its spec pages 404 in production builds, and the move API refuses writes there. Markdown is bundled into the application during build. Production does not read repository files from the Cloudflare filesystem and does not write Markdown through HTTP. No deployment is implied by editing a spec locally.

The migrated historical stories keep their recorded status and remain labeled as outlines unless detailed implementation instructions have been written. Migration does not independently verify old claims of completion.

## Shared implementation notes

Each slice has an Implementation notes board. Store notes as individual Markdown files in `docs/slices/<slice-id>/notes/`; use `docs/templates/implementation-note.md`. `npm run dev` watches this directory too. The shared files are immediately available to other agents working in the same local checkout. The browser view refreshes after valid content regeneration; a production build still requires rebuilding to pick up changes.

Required metadata: globally unique `id`, `title`, `type`, `status`, `author`, quoted `updated` date (`YYYY-MM-DD`), and `affects` (a list of story IDs, which may be empty). Optional `story` identifies the originating story. Required body sections: Summary, Evidence, Impact, and Next action. Note types are `finding`, `proposal`, `decision`, `blocker`, and `handoff`; statuses are `open`, `resolved`, and `superseded`. A note without story or affects applies to the whole slice. Explicit references can link stories in other slices.

Story pages and copied handoffs include notes originating from or affecting that story, plus slice-wide notes. Slice boards show notes stored in that slice. Open blockers appear first, followed by other open notes, then resolved/superseded notes; each group sorts by updated date, newest first. Note status does not automatically change story readiness or completion. Agents must resolve relevant open blockers before doing dependent work.

Use Progress for a story's current work and verification evidence. Use a separate note for cross-story discoveries, decisions, blockers or handoffs. Do not record every action. Read relevant notes before starting, and recheck before changing shared interfaces. Prefer new note files to simultaneous edits of one shared log.

A proposal is not an approved contract. For a decision, record the agreement and rationale in Evidence and update the affected implementation spec. Notes explain why; specs define what to implement. Resolve blockers with evidence and a next step; supersede outdated notes with a link to their replacement rather than erasing their history. Link other notes and specs with relative Markdown paths so they open inside the story map.
