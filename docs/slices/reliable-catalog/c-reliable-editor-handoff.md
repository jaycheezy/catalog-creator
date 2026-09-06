---
id: "c-reliable-editor-handoff"
slice: "reliable-catalog"
title: "Carry source and design into Customize"
step: "design"
status: "done"
effort: "M"
order: 11
tags: ["next"]
dependsOn: ["c-reliable-catalog-project", "c-reliable-full-validation"]
implementation: "specified"
value: "Carries your products and design into the design screen automatically, so you start editing right away without re-selecting everything."
---

# Carry source and design into Customize

## Summary

Open the editor and validator with the catalog, template, and placement selected on the homepage, then restore the same project after a reload.

## Acceptance criteria

- Customize opens the selected template and placement with products from the active project.
- Feed health checks the same project; navigation does not reset a non-demo source to Gibun.
- Reloading or reopening a project restores its saved design and catalog selection.

## Scope

Own creation of a project before leaving the homepage, `projectId` navigation into Customize and Feed health, and restoration of the same source, full product snapshot, selected design, placement, validation, and saved revision. Exclude project listing, browser history management, source refresh, publication history, and multi-user editing.

## Progress

Implemented: Customize and Feed health create a project from the active source, design, and placement. The editor and validator restore the same full catalog and template from the project ID after navigation or reload.

## Implementation guidance

`src/app/page.tsx` must build the source request from the active Store/Feed/CSV tab and send the currently selected adapted template and placement to `POST /api/projects`. Navigate only after a successful durable response; preserve the page and show the error otherwise. Authentication failures route through `/login` with the intended destination.

`src/app/editor/page.tsx` and `src/app/validate/page.tsx` read the project from `GET /api/projects?id=…`. When `projectId` exists, do not load the default Gibun domain or overwrite the project with localStorage templates. Populate products, source label, placement, validation, template, and revisions from the response. Direct legacy editor/validator URLs remain available without a project.

## Interfaces

The shared URL is `/editor?projectId=<prj_id>` or `/validate?projectId=<prj_id>`. The project API response is the only restoration payload; client state does not reconstruct sources from query fragments. The editor must keep `CatalogProject.source.value` read-only for a loaded snapshot and use `project.template.id` as the server-output identity.

Project load failures are visible and must not silently fall back to a demo. A `401` leads to login; invalid/missing IDs remain `400`/`404`; storage failures are retryable service errors.

## Validation

Project route tests cover create/reopen and product preservation. Add client/browser coverage for Store, feed URL, and CSV navigation, reload, login return, invalid project IDs, and failed creation. Confirm the validator and editor display the same row count and validation status from one project.

Run `npm test`, `npm run typecheck`, and `npm run build`. Manual evidence should capture a non-Gibun CSV or WooCommerce project before and after reload.

## Completion handoff

Reviewers should identify the navigation and restoration paths, show the same project/source/design before and after reload, include failure evidence, and report command results. Placement and publication stories may extend the restored aggregate but must preserve this project-ID contract.
