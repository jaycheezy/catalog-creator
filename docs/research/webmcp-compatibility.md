# Catalog Forge WebMCP compatibility spike

Date: 2026-09-05, verified 2026-09-06  
Story: [`c-agent-browser-spike`](../slices/agent-assisted-workspace/A1-browser-compatibility.md)  
Status: passed in the Terra-backed Codex In-app Browser

## Outcome

The temporary Catalog Forge probe passed the required end-to-end gate in the Terra-backed Codex In-app Browser. The original failure was a development-only React Strict Mode race: its throwaway effect mount began asynchronous registration, which raced the real mount and produced duplicate registration. Deferring registration one microtask prevents the discarded mount from registering.

Terra discovered both page tools, returned bounded editor context, visibly changed the draft background from `#ffffff` to `#0f5132`, and restored it to `#ffffff` with `persisted: false`. No custom bridge, relay, extension, credential change, or persisted probe save was introduced. Luna remains unsupported and Chrome continues to use the normal unsupported-browser fallback.

## Environment and setup

- Application: Catalog Forge at `http://localhost:3005`, served by the repository's existing Next development server.
- Framework: Next.js `16.3.3`; React `19.2.8`; Node dependency installation from the repository lockfile.
- Intended surface: Codex In-app Browser, with the development editor opened at `/editor?projectId=prj_1a2392959b0c4b058d41198f60b1223b&webmcpProbe=1`.
- External browser comparison: logged-in Chrome profile, binary version `152.0.7977.76`, same local editor URL and fixture project.
- Fixture: existing local development project `prj_1a2392959b0c4b058d41198f60b1223b`, 31 loaded product rows, saved template background `#ffffff`.
- Probe activation: development build only, an explicit `webmcpProbe=1` query parameter, and a loaded `projectId`. The normal editor and production build do not register these tools.
- Current browser guidance requires a Chromium early-preview build and the `#enable-webmcp-testing` flag. The installed Chrome version meets the documented version floor; the flag was not changed during this spike.

Primary references: [WebMCP draft specification](https://webmachinelearning.github.io/webmcp/), [Chrome imperative API guidance](https://github.com/GoogleChrome/modern-web-guidance/blob/main/guides/webmcp/agentic-javascript-tools/guide.md).

## Temporary probe contract

The probe is implemented in [`src/agent/webmcpSpike.ts`](../../src/agent/webmcpSpike.ts) and mounted by [`src/components/WebmcpSpike.tsx`](../../src/components/WebmcpSpike.tsx) from the editor.

- Feature detection prefers `document.modelContext` and falls back to `navigator.modelContext` only when it exposes `registerTool`.
- Registration uses `registerTool(tool, { signal: controller.signal })` for both tools. Cleanup calls `AbortController.abort()`; there is no `unregisterTool()` call.
- `catalog_forge_spike_get_context` is read-only and returns a bounded object containing session, project, template and background identity. It excludes credentials, cookies, product rows and save URLs and is annotated with `readOnlyHint: true`.
- `catalog_forge_spike_set_background` accepts only a six-digit hexadecimal color, changes the current React draft through the editor callback, returns `before`/`after` plus `persisted: false`, and never calls a save API. The returned `before` value is the restore input for the reversible action.
- The callback checks the execution `AbortSignal` before changing state. The browser API's execution result is an object at the page boundary; the WebMCP `executeTool()` API stringifies the result for in-page callers. Terra received ordinary JSON objects from both calls.
- Registration is deferred one microtask from the React effect, avoiding Next development Strict Mode's discarded mount registering duplicate names before the real mount.

## Real browser evidence

### Chrome editor run

The logged-in Chrome tab visibly loaded the fixture editor and showed the probe panel with:

```
Development WebMCP probe
Registration: unsupported
Project: prj_1a2392959b0c4b058d41198f60b1223b
Draft background: #ffffff
```

The normal editor remained usable, including the canvas, product strip and human Save button. This is concrete unsupported-browser fallback evidence, not an inspector-only success. The Chrome CUA surface had no `webmcp` tab capability available for a tool call.

Reloading the editor recreated the panel and again reported `Registration: unsupported`. Navigating to `/story-map` removed the panel; reopening the editor with the probe query recreated a fresh unsupported probe. Two open Chrome tabs using the same fixture each rendered their own editor/probe state; no shared page dispatcher was observed. A second distinct project ID was not available without creating an additional durable fixture, so cross-project isolation was not claimed.

### Codex In-app Browser runs

The in-app browser exposed a `webmcp` capability alongside `pageAssets`. Calling its actual discovery entry point, `fetchTools()`, failed before page tools could be listed:

```
gpt-5.6-luna does not support command "webmcp_list_tools".
```

This is the intended Codex/browser discovery path, but it is unavailable to the current model surface. The in-app browser has a separate session and redirected the protected editor URL to login; no credentials were changed or transmitted by the spike.

The original Luna run was blocked as described above. The Terra-backed run on 2026-09-06 completed the positive path:

- Discovery listed `catalog_forge_spike_get_context` and `catalog_forge_spike_set_background` from the fixture editor.
- `catalog_forge_spike_get_context({})` returned `ok: true`, `schemaVersion: 1`, the current session/project/template identity, `background: "#ffffff"`, and `persisted: false`.
- `catalog_forge_spike_set_background({ background: "#0f5132" })` returned `before: "#ffffff"`, `after: "#0f5132"`, and `persisted: false`. The visible probe panel and editor background input changed to `#0f5132`; the editor showed unsaved changes.
- Calling the same action with `#ffffff` restored the panel, color input and saved-state UI to their original values, without a save request.
- On reload, the editor visibly reported `Registration: registered`; an initial discovery request raced the asynchronous tool-change notification, and a refetch immediately after that notification listed both tools. Navigating to `/story-map` produced no page tools. A second editor tab registered its own pair of tools.

The in-app session remained authenticated throughout; logout and a second distinct fixture project were not exercised because neither was needed to prove the bounded A1 contract and creating another durable fixture was outside the spike.

## Acceptance-to-evidence

| Criterion | Evidence | Result |
| --- | --- | --- |
| Real context query and reversible visible action from Codex/browser | Terra discovery, context result, visible `#ffffff` → `#0f5132` change, and visible restore to `#ffffff` | **Passed** |
| Runtime versions, setup, registration/cleanup, reload/navigation, fallback | Environment and contract sections above; Terra reload and navigation behavior; independent second tab; Chrome unsupported fallback | **Passed, with documented limitations** |
| About one day and separately estimated bridge | Spike remained a development-only probe. No bridge was built; the fallback estimate is retained below | **Passed** |

## Bridge estimate and follow-up

Do not build a custom extension or relay in A1. First rerun the exact local URL and fixture with a Terra-backed Codex session. If Terra cannot discover and invoke these page tools, evaluate an existing browser bridge separately: estimate **2–4 engineering days** for connector discovery, browser/runtime setup, auth boundary review, tool discovery/invocation proof, and cleanup verification. This estimate excludes custom extension development, remote MCP transport, and production toolset work.
