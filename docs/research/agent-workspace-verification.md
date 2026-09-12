# Agent-assisted workspace verification

Date: 12 September 2026  
Slice: [`agent-assisted-workspace`](../slices/agent-assisted-workspace/index.md)  
Story: [`c-agent-workflow-proof`](../slices/agent-assisted-workspace/A7-workflow-proof.md)  
Result: passed with the documented browser and product-scope limitations

## Environment

- macOS 15.6.1 (24G90), Apple Silicon host
- Node.js 26.0.0, npm 11.12.1
- Next.js 16.3.3 development server at `127.0.0.1:3005`
- Codex In-app Browser with its advertised `webmcp` capability
- Google Chrome 152.0.7977.83 as the unsupported-browser control
- Password-protected, local-file storage only; R2 variables were explicitly disabled for the run

## Reproducible fixture

Two disposable projects were written to the local project store and deleted after verification:

| Project | Purpose | Durable baseline |
| --- | --- | --- |
| `prj_a7workflow00001` | Primary inspect/edit/review/save flow | Project and template revision 1, white 1:1 master |
| `prj_a7workflow00002` | Two-tab and Chrome fallback control | Project and template revision 1, pale-blue 1:1 master |

Each project had 60 rows with stable source IDs `fixture:row:001` through `fixture:row:060`. Row 2 had a valid lower sale price, row 3 had a 169-character title, row 4 had no image, row 8 was out of stock, and row 56 used the invalid price `19.9 EUR`. All other rows used complete local fixture fields and a local SVG image. The template contained `layer_image`, `layer_title`, and `layer_price`; the title and price used `{{title}}` and `{{price}}` bindings. Recreate the fixture by generating those 60 rows and assigning the two baselines above to the local project-store JSON while the R2 variables are unset. No merchant catalog data is needed.

## Acceptance evidence

| Requirement | Browser/tool evidence | Result |
| --- | --- | --- |
| Inspect and explain a complete catalog | `get_context` reported 60/60 rows. `query_products` found row 3 as the longest title, row 2 as the sole sale, and row 4 as the missing-image item. `get_validation(issueCode: "invalid-price")` returned row 56 and `fixture:row:056`, proving validation covered the full snapshot beyond the maximum 50-row query page. | Pass |
| Reject invalid input atomically | Unknown product `fixture:row:999` returned `PRODUCT_NOT_FOUND`; a JavaScript URL background returned `UNSUPPORTED_OPERATION`; an unexpected edit property returned `INVALID_ARGUMENT`. Draft and view revisions remained 0 and the design stayed saved. | Pass |
| Pause and idempotent retry | The native Pause control made a valid mutation return `UNSUPPORTED_OPERATION` with no revision change. After resume, `a7-readable-title-green-price` changed two layers at draft revision 1. Repeating the identical operation ID and body returned the same transaction token with an already-applied warning; activity count remained 1. | Pass |
| Bounded visual review | `preview_design` returned six exact cells for rows 2, 3 and 4 across 1:1 and 9:16, with captured revision 1, `surface: browser-draft`, and `persisted: false`. The visible grid identified each source ID, sale value and missing-image fallback. | Pass |
| Human interleaving and recovery | A normal Properties-panel change set the title color to `#1d4ed8` and advanced the draft to 2. The prepared revision-1 command returned `REVISION_CONFLICT` and preserved the human value. A refreshed revision-2 background change applied at 3; its undo advanced to 4, restored white, and retained both the human title color and the earlier green badge. | Pass |
| Human save and reload | The existing Save button advanced the durable project/template revision from 1 to 2 while draft revision stayed 4. Reload created a new session at draft/view 0 with no activity, `dirty: false`, and the saved `#1d4ed8` title plus `#14532d` price badge. The 60 source rows and invalid row 56 remained unchanged. | Pass |
| No tool publication or source edits | Tool receipts consistently reported `persisted: false`. Before and after the human save, publication was `not-published`; the local publication store contained no record for either fixture project. Product count and the deliberate source error were unchanged. | Pass |
| Two-tab isolation and navigation cleanup | Two IAB tabs produced different session IDs for different projects. The control kept its pale-blue background and independent selection. Passing the first identity to the second returned `SESSION_CHANGED`. Navigating the second tab to Story Map exposed no page tools and its prior handle reported stale registration. | Pass |
| Cancellation and reconciliation | A one-millisecond caller timeout cancelled a 50-row query at the browser transport. A fresh context read showed draft 4, view 1 and dirty state unchanged. Focused command tests cover the structured `CANCELLED` response before a mutation commits; callers must still reconcile context/receipts after an uncertain timeout. | Pass |
| Authentication loss/logout lifecycle | A2's password-protected real-browser run invalidated the active credentials, redirected to Sign in and removed registrations. Current tests cover execution-time `AUTH_REQUIRED` and registration abort on cleanup. This verifies the lifecycle boundary the tools depend on; the current product has no visible logout control. | Pass with equivalent auth-loss proof |
| Browser without WebMCP | Chrome advertised only `pageAssets`, displayed `Unavailable in this browser`, and completed a normal human color edit, Save, and settled reload with `#7c3aed` intact. | Pass |

## Screenshots

- [Six-cell browser-draft review](evidence/agent-workspace/a7-review-grid.jpg)
- [Human-saved design and activity](evidence/agent-workspace/a7-human-saved.jpg)
- [Chrome fallback with WebMCP unavailable](evidence/agent-workspace/a7-chrome-fallback.jpg)

## Concise receipts

- Primary session started at draft/view `0/0`, saved project revision 1 and `not-published`.
- Design operation `a7-readable-title-green-price` returned draft 1, two changed layer IDs and one `txn_…` token; identical retry returned the same token.
- Preview returned one `view_…` ID, draft 1 and six cells; it changed only the view revision to 1.
- Human edit produced draft 2; stale operation was rejected at 2; recovery applied at 3; undo returned draft 4.
- Human Save returned durable project/template revision 2. Reload reset session-local revisions and history while preserving the saved content.

## Limits and follow-ups

- The screenshot shows why visual judgment remains necessary: the deliberately long title is clipped in its fixed-height layer after increasing font size. The tool reports the real browser result and does not claim the design is aesthetically approved.
- Caller-side WebMCP cancellation surfaced as a browser transport timeout rather than the application's structured `CANCELLED` envelope. The documented recovery remains a fresh context/receipt read; pre-commit cancellation is pinned by focused tests.
- Authentication cleanup was verified through equivalent credential loss because Catalog Forge has an API logout route but no visible logout action. Adding account UI was outside this slice and unnecessary for the registration lifecycle contract.
- The review is browser-draft output. It does not establish server PNG parity, conditional badge visibility, agent-driven placement saves, remote MCP access, or agent publication.

## Repository gate

- `npm test`: 28 files, 182 tests passed; story-map generator validated 50 stories across 6 slices and 15 notes.
- `npm run typecheck`: passed.
- `npm run lint`: passed with zero warnings.
- `npm run build`: passed with 99 generated pages.
