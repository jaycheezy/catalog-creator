"use client";

import { useCallback, useEffect, useState, useMemo, useReducer, useRef } from "react";
import "@fontsource/inter/400.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import { TemplateRenderer } from "@/editor/TemplateRenderer";
import { AllSizesCanvas, type AllSizesSheet } from "@/editor/AllSizesCanvas";
import { LayersPanel } from "@/editor/LayersPanel";
import { PropertiesPanel } from "@/editor/PropertiesPanel";
import { createDefaultTemplate, SIZE_PRESETS } from "@/editor/types";
import { STARTER_TEMPLATES } from "@/editor/starterTemplates";
import { adaptTemplateToSize } from "@/editor/autoLayout";
import type { Template, Layer } from "@/editor/types";
import type { FeedRow } from "@/lib/facebook";
import { buildRenderUrl } from "@/lib/renderProduct";
import type { CatalogProject } from "@/lib/catalogProject";
import { savedPlacementTemplate, SIZE_PRESET_IDS, type SizePresetId } from "@/lib/catalogProject";
import {
  isPlacementSaved,
  parseVariantDraftId,
  placementFingerprint,
  placementView,
  variantDraftId,
} from "@/editor/placementState";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { validateCatalog, type CatalogValidationResult } from "@/lib/catalogValidation";
import { isTemplateSaved, templateFingerprint, type SavedTemplateRecord } from "@/editor/saveState";
import { hasUnsavedPublicationDesign } from "@/editor/publicationState";
import { WebmcpSpike } from "@/components/WebmcpSpike";
import { AgentWorkspaceProvider } from "@/components/AgentWorkspaceProvider";
import { AgentReviewGrid } from "@/components/AgentReviewGrid";
import { AGENT_WORKSPACE_TOOL_NAMES } from "@/agent/tools";
import type { WorkspaceCatalogSnapshot } from "@/agent/catalogQueries";
import {
  workspaceCapabilities,
  workspaceSourceSummary,
  type WorkspaceContextSnapshot,
  type WorkspaceDesignSnapshot,
  type WorkspaceDraftTargetId,
  type WorkspaceReviewState,
  type WorkspaceViewChange,
} from "@/workspace/contracts";
import { INITIAL_WORKSPACE_REVISION, workspaceRevisionReducer } from "@/workspace/controller";

const STORAGE_KEY = "catalog-forge-templates-v1";
const DOMAIN_KEY = "catalog-forge-editor-domain";
const AGENT_CAPABILITIES = workspaceCapabilities([...AGENT_WORKSPACE_TOOL_NAMES]);

type MerchantNavTab = "design" | "products" | "elements" | "templates";

export default function EditorPage() {
  const router = useRouter();
  // Resolved after hydration so the server and client first render agree.
  // Null means the query string has not been read yet; no loading starts.
  const [projectId, setProjectId] = useState<string | null>(null);
  // Standalone homepage-slot mode (?templateId=homepage-showcase-* with no
  // projectId): loads that template for visual editing; saves write straight
  // back under the same id, so the homepage hero picks them up.
  const [templateIdParam, setTemplateIdParam] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProjectId(new URLSearchParams(window.location.search).get("projectId") || "");
    setTemplateIdParam(new URLSearchParams(window.location.search).get("templateId") || "");
  }, []);
  const [projectPlacement, setProjectPlacement] = useState<CatalogProject["placement"]>("carousel");
  const [projectError, setProjectError] = useState<string | null>(null);
  const [projectContext, setProjectContext] = useState<Pick<CatalogProject, "id" | "name" | "source" | "importStatus"> | null>(null);
  const [projectValidation, setProjectValidation] = useState<CatalogValidationResult | null>(null);
  const [templates, setTemplates] = useState<Template[]>(() => [createDefaultTemplate("1:1")]);
  const [activeId, setActiveId] = useState<string>(() => templates[0].id);
  const [selectedId, setSelectedId] = useState<string | null>("layer_title");
  const [scale, setScale] = useState(0.42);
  const [domain, setDomain] = useState("store.gibun.at");
  const [products, setProducts] = useState<FeedRow[]>([]);
  const [productIdx, setProductIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState<Record<string, SavedTemplateRecord>>({});
  const [savedPlacements, setSavedPlacements] = useState<Partial<Record<SizePresetId, SavedTemplateRecord>>>({});
  const [placementSnapshots, setPlacementSnapshots] = useState<Partial<Record<SizePresetId, Template>>>({});
  const [masterId, setMasterId] = useState<string>(() => templates[0].id);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publication, setPublication] = useState<{
    active: { publishedAt: number; projectRevision: number; publishedRows: number; skippedProductIds: string[] } | null;
    lastAttempt: {
      status: "success" | "failed";
      attemptedRevision: number;
      attemptedAt: number;
      error?: { message: string; code: string; retryable: boolean };
      skippedProductIds?: string[];
    } | null;
  } | null | undefined>(undefined);
  const [projectRevision, setProjectRevision] = useState(0);
  const [{ draftRevision, viewRevision }, dispatchWorkspaceRevision] = useReducer(
    workspaceRevisionReducer,
    INITIAL_WORKSPACE_REVISION,
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<{ message: string; retryable: boolean } | null>(null);
  const [agentHighlightedLayerIds, setAgentHighlightedLayerIds] = useState<string[]>([]);
  const [agentReview, setAgentReview] = useState<WorkspaceReviewState | null>(null);
  const [leftTab, setLeftTab] = useState<MerchantNavTab>("design");
  const exportRef = useRef<HTMLDivElement>(null);
  // Sizes on the shared canvas. The canvas is the default (and only) view;
  // the toolbar dropdown filters this list.
  const [visibleSizes, setVisibleSizes] = useState<SizePresetId[]>(["1:1", "4:5", "9:16"]);
  const [sizesOpen, setSizesOpen] = useState(false);

  const active = useMemo(() => templates.find((t) => t.id === activeId) ?? templates[0], [templates, activeId]);
  const master = useMemo(() => templates.find((t) => t.id === masterId) ?? active, [templates, masterId, active]);
  const editingVariantSize = parseVariantDraftId(activeId);
  const product = products[productIdx] ?? null;
  const savedTemplate = savedTemplates[active.id];
  const isSaved = isTemplateSaved(active, savedTemplate);
  const placementRecordForActive = !savedTemplate && editingVariantSize ? savedPlacements[editingVariantSize] : undefined;
  const placementSavedForActive = placementRecordForActive
    ? placementFingerprint(active) === placementRecordForActive.fingerprint
    : false;
  const headerSaved = isSaved || placementSavedForActive;
  const publishBlockedByUnsavedDesign = useMemo(
    () => hasUnsavedPublicationDesign(master, templates, savedTemplates, savedPlacements),
    [master, savedPlacements, savedTemplates, templates],
  );
  const savedId = isSaved
    ? savedTemplate.templateId
    : placementSavedForActive && placementRecordForActive
      ? placementRecordForActive.templateId
      : null;
  const webmcpProbeEnabled = process.env.NODE_ENV !== "production"
    && typeof window !== "undefined"
    && new URLSearchParams(window.location.search).get("webmcpProbe") === "1";

  // C: keyboard-first — ⌘S saves.

  // Load from localStorage
  useEffect(() => {
    if (projectId === null || projectId) return;
    // Homepage-slot mode loads its template below — never restore (or
    // overwrite) the generic local session with it.
    if (new URLSearchParams(window.location.search).get("templateId")) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Template[];
        if (parsed.length) {
          // Restore the user's local editor session after hydration.
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setTemplates(parsed);
          setActiveId(parsed[0].id);
        }
      }
      const d = localStorage.getItem(DOMAIN_KEY);
      if (d) setDomain(d);
    } catch {}
  }, [projectId]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("templateId")) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  }, [templates]);

  useEffect(() => {
    localStorage.setItem(DOMAIN_KEY, domain);
  }, [domain]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/preview?domain=${encodeURIComponent(domain)}`);
      const json = await res.json() as { error?: string; preview?: FeedRow[] };
      if (!res.ok) throw new Error(json.error);
      setProducts(json.preview ?? []);
      setProductIdx(0);
    } catch (e) {
      alert(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId === null) return;
    if (projectId) {
      // Loading state tracks the external project fetch initiated by this effect.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(true);
      setProjectError(null);
      fetch(`/api/projects?id=${encodeURIComponent(projectId)}`)
        .then(async (res) => {
          const json = await res.json() as CatalogProject & {
            error?: string;
            publication?: {
              active: { publishedAt: number; projectRevision: number; publishedRows: number; skippedProductIds: string[] } | null;
              lastAttempt: {
                status: "success" | "failed";
                attemptedRevision: number;
                attemptedAt: number;
                error?: { message: string; code: string; retryable: boolean };
                skippedProductIds?: string[];
              } | null;
            } | null;
          };
          if (!res.ok) throw new Error(json.error || "Could not load project");
          const project = json as CatalogProject;
          setTemplates([project.template]);
          setActiveId(project.template.id);
          setMasterId(project.template.id);
          setProducts(project.products);
          setProductIdx(0);
          setDomain(project.source.value);
          setProjectPlacement(project.placement);
          setProjectContext({ id: project.id, name: project.name, source: project.source, importStatus: project.importStatus });
          setProjectValidation(project.validation ?? null);
          setProjectRevision(project.revision ?? 0);
          dispatchWorkspaceRevision({ type: "reset" });
          setAgentHighlightedLayerIds([]);
          setAgentReview(null);
          setPublication(json.publication ?? null);
          setSavedTemplates({
            [project.template.id]: {
              templateId: project.template.id,
              fingerprint: templateFingerprint(project.template),
              revision: project.template.revision ?? 0,
            },
          });
          const seeded: Partial<Record<SizePresetId, SavedTemplateRecord>> = {};
          for (const sizeId of SIZE_PRESET_IDS) {
            const saved = savedPlacementTemplate(project, sizeId);
            if (saved) {
              seeded[sizeId] = {
                templateId: saved.id,
                fingerprint: placementFingerprint(saved),
                revision: saved.revision ?? 0,
              };
            }
          }
          setSavedPlacements(seeded);
          setPlacementSnapshots({ ...(project.placementTemplates ?? {}) });
          setSaveNotice(null);
          setSaveError(null);
        })
        .catch((error) => setProjectError(error instanceof Error ? error.message : String(error)))
        .finally(() => setLoading(false));
      return;
    }
    fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Homepage-slot mode: no project, ?templateId=<slot-id>. Loads the stored
  // slot template (or its demo default via the admin page link) as the sole
  // draft, seeded as saved so revision conflicts are detected on save.
  useEffect(() => {
    if (projectId === null || projectId || !templateIdParam) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetch(`/api/templates?id=${encodeURIComponent(templateIdParam)}`)
      .then(async (res) => {
        const json = (await res.json()) as Template & { error?: string };
        if (!res.ok) throw new Error(json.error || "Could not load template");
        setTemplates([json]);
        setActiveId(json.id);
        setMasterId(json.id);
        setProductIdx(0);
        setSaveNotice(null);
        setSaveError(null);
        setSavedTemplates({
          [json.id]: {
            templateId: json.id,
            fingerprint: templateFingerprint(json),
            revision: json.revision ?? 0,
          },
        });
      })
      .catch((error) => setProjectError(error instanceof Error ? error.message : String(error)))
      .finally(() => setLoading(false));
  }, [projectId, templateIdParam]);

  const markHumanDraftChange = () => {
    setAgentHighlightedLayerIds([]);
    setAgentReview(null);
    dispatchWorkspaceRevision({ type: "draft-changed", actor: "human" });
  };

  const updateActive = (patch: Partial<Template> | Template) => {
    setTemplates((prev) =>
      prev.map((t) => {
        if (t.id !== activeId) return t;
        if ("layers" in patch && (patch as Template).layers) return { ...(patch as Template), updatedAt: Date.now() };
        return { ...t, ...patch, updatedAt: Date.now() } as Template;
      })
    );
    markHumanDraftChange();
  };

  const updateLayer = (id: string, patch: Partial<Layer> | ((l: Layer) => Partial<Layer>)) => {
    setTemplates((prev) =>
      prev.map((t) =>
        t.id !== activeId
          ? t
          : {
              ...t,
              layers: t.layers.map((l) => {
                if (l.id !== id) return l;
                const p = typeof patch === "function" ? patch(l) : patch;
                return { ...l, ...p, style: p.style ? { ...l.style, ...p.style } : l.style };
              }),
              updatedAt: Date.now(),
            }
      )
    );
    markHumanDraftChange();
  };

  const setProbeBackground = (background: string) => {
    updateActive({ background });
  };

  const selectLayer = (id: string | null) => {
    setSelectedId(id);
    dispatchWorkspaceRevision({ type: "view-changed", actor: "human" });
  };

  const selectProduct = (index: number) => {
    setProductIdx(index);
    dispatchWorkspaceRevision({ type: "view-changed", actor: "human" });
  };

  // Every placement gets an independent draft so each sheet on the shared
  // canvas is directly editable. Drafts seed from the saved snapshot (or a
  // fresh master adaptation), so save state stays honest and editing one
  // size never affects the others.
  useEffect(() => {
    const missing = SIZE_PRESET_IDS.filter(
      (sizeId) => sizeId !== master.sizeId && !templates.some((t) => t.id === variantDraftId(sizeId)),
    );
    if (missing.length === 0) return;
    setTemplates((prev) => {
      const next = [...prev];
      for (const sizeId of missing) {
        const draftId = variantDraftId(sizeId);
        if (next.some((t) => t.id === draftId)) continue;
        const preset = SIZE_PRESETS.find((p) => p.id === sizeId) ?? SIZE_PRESETS[0];
        const base = placementSnapshots[sizeId] ?? adaptTemplateToSize(master, preset);
        next.push({ ...base, id: draftId, updatedAt: Date.now() });
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [master, placementSnapshots, templates]);

  /** Update any template by id (multi-sheet canvas), not just the active one. */
  const updateTemplateById = (id: string, next: Template) => {
    setTemplates((prev) => prev.map((t) => (t.id === id ? { ...next, updatedAt: Date.now() } : t)));
    markHumanDraftChange();
  };

  /** Clicking a sheet makes it the active template; panels follow. */
  const activateSheet = (templateId: string, layerId: string | null) => {
    if (templateId !== activeId) setActiveId(templateId);
    selectLayer(layerId);
  };

  /** Visible sheets for the shared canvas, in placement order. */
  const allSizesSheets: AllSizesSheet[] = useMemo(() => {
    const visible = SIZE_PRESETS.filter((p) => visibleSizes.includes(p.id as SizePresetId));
    const presets = visible.length > 0 ? visible : SIZE_PRESETS;
    return presets.map((preset) => {
        const sizeId = preset.id as SizePresetId;
        const entry = templates.find((t) => t.id === variantDraftId(sizeId));
        const template = placementView(master, SIZE_PRESETS, sizeId, entry, placementSnapshots[sizeId]);
        const adaptedFresh = sizeId === master.sizeId ? master : adaptTemplateToSize(master, preset);
        const snapshot = placementSnapshots[sizeId];
        return {
          sizeId,
          label: preset.label,
          template,
          canReset: !entry && !!snapshot && sizeId !== master.sizeId
            && placementFingerprint(snapshot) !== placementFingerprint(adaptedFresh),
        };
      });
    },
    [master, placementSnapshots, templates, visibleSizes],
  );

  const addLayer = (type: Layer["type"]) => {
    const layer: Layer = {
      id: `layer_${Math.random().toString(36).slice(2, 7)}`,
      type,
      name: type === "text" ? "New Text" : type === "badge" ? "New Badge" : "New Shape",
      x: active.width / 2 - 150,
      y: active.height / 2 - 40,
      w: 300,
      h: type === "shape" ? 120 : 64,
      rotation: 0,
      z: active.layers.length + 1,
      visible: true,
      locked: false,
      style:
        type === "badge"
          ? { background: "#111", color: "#fff", fontSize: 32, fontWeight: 700, borderRadius: 999, textAlign: "center" }
          : type === "shape"
            ? { background: "#f4f4f5", borderRadius: 16 }
            : { color: "#111", fontSize: 36, fontWeight: 600, textAlign: "center" },
      content: type === "text" ? "Edit me — {{title}}" : type === "badge" ? "{{price}}" : undefined,
    };
    updateActive({ ...active, layers: [...active.layers, layer] });
    selectLayer(layer.id);
  };

  const duplicateLayer = (id: string) => {
    const l = active.layers.find((x) => x.id === id);
    if (!l) return;
    const copy = { ...l, id: `layer_${Math.random().toString(36).slice(2, 7)}`, name: l.name + " copy", x: l.x + 20, y: l.y + 20, z: active.layers.length + 1 };
    updateActive({ ...active, layers: [...active.layers, copy] });
  };

  const deleteLayer = (id: string) => {
    updateActive({ ...active, layers: active.layers.filter((l) => l.id !== id) });
    if (selectedId === id) selectLayer(null);
  };

  const backToMaster = () => {
    setActiveId(masterId);
    selectLayer(null);
  };

  /**
   * Replace a customized placement with a fresh master adaptation, opening it
   * as a draft so the user reviews before saving. Without this, a saved
   * snapshot could never rejoin the master lineage.
   */
  const resetVariant = (sizeId: SizePresetId) => {
    const preset = SIZE_PRESETS.find((p) => p.id === sizeId) ?? SIZE_PRESETS[0];
    const draftId = variantDraftId(sizeId);
    setTemplates((prev) => {
      const fresh = sizeId === master.sizeId ? master : adaptTemplateToSize(master, preset);
      const draft: Template = { ...fresh, id: draftId, updatedAt: Date.now() };
      return [...prev.filter((t) => t.id !== draftId), draft];
    });
    setActiveId(draftId);
    selectLayer(null);
    markHumanDraftChange();
  };
  const agentWorkspaceContext = useMemo<Omit<WorkspaceContextSnapshot, "sessionId"> | null>(() => {
    if (!projectId || !projectContext || projectContext.id !== projectId || publication === undefined) return null;
    const activeTargetId: WorkspaceDraftTargetId = editingVariantSize ? `placement:${editingVariantSize}` : "master";
    const activeSavedRevision = editingVariantSize
      ? savedPlacements[editingVariantSize]?.revision ?? null
      : savedTemplates[master.id]?.revision ?? null;
    const placements = SIZE_PRESET_IDS.map((sizeId) => {
      const entry = templates.find((template) => template.id === variantDraftId(sizeId));
      const snapshot = placementSnapshots[sizeId];
      const candidate = placementView(master, SIZE_PRESETS, sizeId, entry, snapshot);
      const saved = savedPlacements[sizeId];
      const targetId: WorkspaceDraftTargetId = sizeId === master.sizeId ? "master" : `placement:${sizeId}`;
      const masterRecord = savedTemplates[master.id];
      return {
        sizeId,
        targetId,
        active: targetId === activeTargetId,
        open: sizeId === master.sizeId || Boolean(entry),
        saved: sizeId === master.sizeId
          ? isTemplateSaved(master, masterRecord) || isPlacementSaved(master, SIZE_PRESETS, sizeId, saved?.fingerprint, candidate)
          : isPlacementSaved(master, SIZE_PRESETS, sizeId, saved?.fingerprint, candidate),
        savedRevision: sizeId === master.sizeId ? masterRecord?.revision ?? saved?.revision ?? null : saved?.revision ?? null,
      };
    });
    const publishedRevision = publication?.active?.projectRevision ?? null;
    const source = workspaceSourceSummary(projectContext.source);
    return {
      projectId,
      draftRevision,
      viewRevision,
      data: {
        busy: { loading, saving, publishing },
        project: {
          name: projectContext.name,
          source: {
            ...source,
            currencyCodes: projectValidation?.currencyCodes ?? source.currencyCodes,
          },
          productCount: products.length,
          totalProducts: projectContext.importStatus.totalProducts,
          totalRows: projectContext.importStatus.totalRows,
          importComplete: projectContext.importStatus.complete,
          validation: {
            status: projectValidation?.status ?? "unavailable",
            errors: projectValidation?.errorCount ?? 0,
            warnings: projectValidation?.warningCount ?? 0,
            imageChecks: projectValidation?.imageChecks ?? "unavailable",
          },
        },
        design: {
          activeTargetId,
          activeSizeId: active.sizeId as SizePresetId,
          masterSizeId: master.sizeId as SizePresetId,
          activeSaved: headerSaved,
          dirty: publishBlockedByUnsavedDesign,
          savedProjectRevision: projectRevision,
          savedTemplateRevision: activeSavedRevision,
          placements,
        },
        view: {
          mode: "all-sizes",
          selectedProductId: product?.source_id ?? product?.id ?? null,
          selectedLayerId: selectedId,
        },
        publication: {
          status: publication === null ? "unavailable" : publication.active ? "published" : "not-published",
          publishedProjectRevision: publishedRevision,
          draftNewer: publishedRevision !== null && projectRevision > publishedRevision,
        },
        agent: {
          mutationsAvailable: true,
          paused: false,
          activityCount: 0,
          canUndo: false,
        },
        capabilities: AGENT_CAPABILITIES,
      },
    };
  }, [
    active.sizeId,
    draftRevision,
    editingVariantSize,
    headerSaved,
    loading,
    master,
    placementSnapshots,
    product,
    products.length,
    projectContext,
    projectId,
    projectRevision,
    projectValidation,
    publication,
    publishing,
    publishBlockedByUnsavedDesign,
    savedPlacements,
    savedTemplates,
    saving,
    selectedId,
    templates,
    viewRevision,
  ]);
  const agentCatalogSnapshot = useMemo<WorkspaceCatalogSnapshot | null>(() => {
    if (!projectId || !projectContext || projectContext.id !== projectId) return null;
    return {
      projectId,
      revision: projectRevision,
      products,
      validation: projectValidation ?? validateCatalog(products, {
        importComplete: projectContext.importStatus.complete,
        imageChecks: "not-run",
      }),
    };
  }, [products, projectContext, projectId, projectRevision, projectValidation]);
  const agentDesignSnapshot = useMemo<WorkspaceDesignSnapshot | null>(() => {
    if (!agentWorkspaceContext) return null;
    return { targetId: agentWorkspaceContext.data.design.activeTargetId, template: active };
  }, [active, agentWorkspaceContext]);

  const applyAgentDesign = useCallback((
    _targetId: WorkspaceDraftTargetId,
    template: Template,
    clearSelectedLayer: boolean,
  ) => {
    setAgentReview(null);
    setTemplates((previous) => previous.map((entry) => entry.id === template.id ? template : entry));
    if (clearSelectedLayer) {
      setSelectedId(null);
      dispatchWorkspaceRevision({ type: "view-changed", actor: "agent" });
    }
    dispatchWorkspaceRevision({ type: "draft-changed", actor: "agent" });
    setSaveError(null);
    setSaveNotice(null);
  }, []);

  const applyAgentView = useCallback((change: WorkspaceViewChange) => {
    if (change.productIndex !== undefined) setProductIdx(change.productIndex);
    if (change.layerId !== undefined) setSelectedId(change.layerId);
    // The shared canvas is the only view; any panel change just exits review.
    if (change.panel !== undefined) {
      setAgentReview(null);
    }
    dispatchWorkspaceRevision({ type: "view-changed", actor: "agent" });
  }, []);

  const applyAgentPreview = useCallback((review: WorkspaceReviewState) => {
    setAgentReview(review);
    dispatchWorkspaceRevision({ type: "view-changed", actor: "agent" });
  }, []);

  const closeAgentReview = useCallback(() => {
    setAgentReview(null);
    dispatchWorkspaceRevision({ type: "view-changed", actor: "human" });
  }, []);
  /**
   * Owner draft preview link (legacy render + explicit draft flag). Shared
   * feed URLs never carry the flag: anonymous readers always see the
   * published snapshot.
   */
  const previewRenderLink = (templateId: string): string | null => {
    if (!projectId || !product) return null;
    try {
      return buildRenderUrl(templateId, { projectId, draft: true }, product);
    } catch {
      return null;
    }
  };
  const productRenderUrl = savedId && product
    ? projectId
      ? previewRenderLink(savedId)
      : buildRenderUrl(savedId, domain, product)
    : null;

  // Redirect to /login if a password is configured and we're not signed in
  useEffect(() => {
    fetch("/api/login")
      .then((r) => r.json())
      .then((j: unknown) => {
        const status = j as { configured?: boolean; authenticated?: boolean };
        if (status.configured && !status.authenticated) router.push(`/login?next=${encodeURIComponent(`/editor${window.location.search}`)}`);
      })
      .catch(() => {});
  }, [router]);

  /**
   * Save the open per-size draft without touching other placements. The
   * server merges the single key; every other placement keeps its saved
   * record, so only this card changes state.
   */
  const saveVariantPlacement = async (sizeId: SizePresetId, draft: Template) => {
    setSaving(true);
    setSaveError(null);
    try {
      if (projectId) {
        const res = await fetch("/api/projects", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: projectId, placementTemplates: { [sizeId]: draft }, expectedRevision: projectRevision }),
        });
        const json = await res.json() as {
          error?: string;
          retryable?: boolean;
          revision?: number;
          variants?: { sizeId: string; templateId: string; templateRevision: number }[];
        };
        if (res.status === 401) {
          router.push(`/login?next=${encodeURIComponent(`/editor${window.location.search}`)}`);
          return;
        }
        if (!res.ok) {
          setSaveError({ message: json.error || `Could not save the ${sizeId} variant.`, retryable: json.retryable !== false });
          return;
        }
        const confirmed = (json.variants ?? []).find((variant) => variant.sizeId === sizeId);
        if (!confirmed) {
          setSaveError({ message: `The server did not confirm placement ${sizeId}. Nothing was marked saved.`, retryable: true });
          return;
        }
        setSavedPlacements((prev) => ({
          ...prev,
          [sizeId]: { templateId: confirmed.templateId, fingerprint: placementFingerprint(draft), revision: confirmed.templateRevision },
        }));
        setPlacementSnapshots((prev) => ({ ...prev, [sizeId]: { ...draft } }));
        setProjectRevision(Number(json.revision ?? projectRevision));
        setSaveNotice(`Saved the ${sizeId} variant (project revision ${Number(json.revision ?? projectRevision)}). Other placements unchanged.`);
        return;
      }
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, id: undefined }),
      });
      const json = await res.json() as { error?: string; templateId?: string; id?: string; revision?: number };
      if (res.status === 401) {
        router.push(`/login?next=${encodeURIComponent(`/editor${window.location.search}`)}`);
        return;
      }
      if (!res.ok) throw new Error(json.error || `Could not save the ${sizeId} variant.`);
      const savedTemplateId = json.templateId || json.id;
      if (!savedTemplateId) throw new Error(`No template id returned for ${sizeId}.`);
      setSavedPlacements((prev) => ({
        ...prev,
        [sizeId]: { templateId: savedTemplateId, fingerprint: placementFingerprint(draft), revision: Number(json.revision ?? 0) },
      }));
      setPlacementSnapshots((prev) => ({ ...prev, [sizeId]: { ...draft } }));
      setSaveNotice(`Saved the ${sizeId} variant as a separate template.`);
    } catch (e) {
      setSaveError({ message: e instanceof Error ? e.message : `Could not save the ${sizeId} variant.`, retryable: true });
    } finally {
      setSaving(false);
    }
  };

  const applyStarter = (starterId: string) => {
    const starter = STARTER_TEMPLATES.find((s) => s.id === starterId);
    if (!starter) return;
    if (!headerSaved && !window.confirm("Replace your current design? Unsaved changes will be lost.")) return;
    const built = starter.build(active.sizeId);
    updateActive({ ...active, name: starter.name, background: built.background, layers: built.layers });
    selectLayer(null);
    setLeftTab("design");
  };

  const starterPreviews = useMemo(
    () => STARTER_TEMPLATES.map((s) => ({ ...s, preview: s.build(active.sizeId) })),
    [active.sizeId],
  );

  async function saveToServer() {
    const draft = active;
    if (editingVariantSize) {
      await saveVariantPlacement(editingVariantSize, draft);
      return;
    }
    const savedDraft = savedTemplates[draft.id];
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(projectId ? "/api/projects" : "/api/templates", {
        method: projectId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(projectId
          ? { id: projectId, template: draft, placement: projectPlacement, expectedRevision: projectRevision }
          : { ...draft, expectedRevision: savedDraft?.revision ?? 0 }),
      });
      const json = await res.json() as {
        error?: string;
        retryable?: boolean;
        templateId?: string;
        id?: string;
        templateRevision?: number;
        revision?: number;
      };
      if (res.status === 401) {
        router.push(`/login?next=${encodeURIComponent(`/editor${window.location.search}`)}`);
        return;
      }
      if (!res.ok) {
        setSaveError({ message: json.error || "Save failed", retryable: json.retryable !== false });
        return;
      }
      const savedTemplateId = json.templateId || json.id;
      if (!savedTemplateId) {
        setSaveError({ message: "The server did not return the saved template id.", retryable: true });
        return;
      }
      const templateRevision = Number(json.templateRevision ?? json.revision ?? 0);
      const savedVersion = { ...draft, id: savedTemplateId, revision: templateRevision };
      setSavedTemplates((previous) => {
        const next = { ...previous };
        delete next[draft.id];
        next[savedTemplateId] = {
          templateId: savedTemplateId,
          fingerprint: templateFingerprint(savedVersion),
          revision: templateRevision,
        };
        return next;
      });
      if (projectId) setProjectRevision(Number(json.revision ?? projectRevision));
      if (savedTemplateId !== active.id) {
        setTemplates((prev) => prev.map((t) => (t.id === draft.id ? { ...t, id: savedTemplateId, revision: templateRevision } : t)));
        setActiveId((current) => current === draft.id ? savedTemplateId : current);
      } else {
        setTemplates((prev) => prev.map((t) => (t.id === draft.id ? { ...t, revision: templateRevision } : t)));
      }
    } catch (e) {
      setSaveError({
        message: e instanceof Error ? e.message : "The save could not be confirmed.",
        retryable: true,
      });
    } finally {
      setSaving(false);
    }
  }

  // C: keyboard-first — ⌘S saves.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (k === "s") {
        e.preventDefault();
        if (!headerSaved && !saving) void saveToServer();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headerSaved, saving, activeId]);

  /**
   * Publish the saved draft: freeze products, validation, and templates into
   * the durable publication record. The stable feed URL does not change;
   * anonymous readers move to the new snapshot on success and keep the old
   * one on failure.
   */
  const publishProject = async () => {
    if (!projectId || publishBlockedByUnsavedDesign) return;
    setPublishing(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/projects/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: projectId, expectedRevision: projectRevision }),
      });
      const json = await res.json() as {
        error?: string;
        code?: string;
        retryable?: boolean;
        projectRevision?: number;
        publishedAt?: number;
        feedUrl?: string;
        publishedRows?: number;
        totalRows?: number;
        skipped?: { productIds: string[]; codes: string[] };
        attempt?: NonNullable<NonNullable<typeof publication>["lastAttempt"]>;
      };
      if (res.status === 401) {
        router.push(`/login?next=${encodeURIComponent(`/editor${window.location.search}`)}`);
        return;
      }
      if (!res.ok) {
        if (json.attempt) {
          setPublication((prev) => ({ active: prev?.active ?? null, lastAttempt: json.attempt ?? null }));
        }
        setSaveError({ message: json.error || "Publish failed.", retryable: json.retryable !== false });
        return;
      }
      const skippedIds = json.skipped?.productIds ?? [];
      setPublication({
        active: {
          publishedAt: Number(json.publishedAt ?? Date.now()),
          projectRevision: Number(json.projectRevision ?? projectRevision),
          publishedRows: Number(json.publishedRows ?? 0),
          skippedProductIds: skippedIds,
        },
        lastAttempt: json.attempt ?? null,
      });
      setSaveNotice(
        skippedIds.length > 0
          ? `Published revision ${Number(json.projectRevision ?? projectRevision)} (${Number(json.publishedRows ?? 0)} of ${Number(json.totalRows ?? 0)} products) — skipped invalid: ${skippedIds.join(", ")}. The feed URL is unchanged.`
          : `Published revision ${Number(json.projectRevision ?? projectRevision)} — the feed URL is unchanged.`,
      );
    } catch (e) {
      setSaveError({ message: e instanceof Error ? e.message : "Publish failed.", retryable: true });
    } finally {
      setPublishing(false);
    }
  };

  const exportJson = () => {    const blob = new Blob([JSON.stringify(active, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${active.name.replace(/\s+/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPng = async () => {
    // Try server render first if template saved (public capability URL)
    if (productRenderUrl) {
      window.open(productRenderUrl, "_blank");
      return;
    }
    const el = exportRef.current;
    if (!el) return;
    const { htmlToPngDataUrl } = await import("@/editor/export");
    try {
      const dataUrl = await htmlToPngDataUrl(el.firstElementChild as HTMLElement);
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${active.name}_${product?.id ?? "preview"}.png`;
      a.click();
    } catch (e) {
      alert("PNG export failed (foreignObject CORS). Save to server and use Server PNG. " + String(e));
    }
  };

  const importJson = (text: string) => {
    try {
      const parsed = JSON.parse(text) as Template;
      // basic validation
      if (!parsed.layers || !parsed.width) throw new Error("Invalid template");
      const withId = { ...parsed, id: active.id, updatedAt: Date.now() };
      setTemplates((prev) => prev.map((t) => (t.id === activeId ? withId : t)));
      markHumanDraftChange();
      setShowJson(false);
    } catch (e) {
      alert("Import failed: " + String(e));
    }
  };

  return (
    <div className="h-screen text-zinc-900 flex flex-col overflow-hidden" style={{ background: "#fbfaf6", color: "#191712" }}>
      <header className="border-b sticky top-0 z-20 bg-white shrink-0" style={{ borderColor: "#e9e4d6" }}>
        <div className="max-w-[1600px] mx-auto px-4 py-2.5 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 font-bold tracking-tight text-[17px]">
            <svg viewBox="0 0 24 24" className="w-6 h-6 shrink-0" aria-hidden="true">
              <path d="M12 2.5c-4.5 4.2-6.5 8.6-6.5 13 4.4 0 8.8-2 13-6.5-1.5-3.2-3.6-5.2-6.5-6.5Z" fill="#3a5a1e" />
              <path d="M12 2.5c.4 5.3-.8 10.3-3.4 14.4" stroke="#fbfaf6" strokeWidth="1.4" strokeLinecap="round" fill="none" />
              <circle cx="17.5" cy="17.5" r="2.6" fill="#7a9b4f" />
            </svg>
            Catalog Forge
          </Link>
          {!projectId ? (
            <div className="flex items-center gap-2">
              <input value={domain} onChange={(e) => setDomain(e.target.value)} disabled={Boolean(projectId)} aria-label="Store domain" className="border rounded-[10px] px-3 py-2 text-[13px] w-48 bg-white disabled:bg-zinc-50" style={{ borderColor: "#e9e4d6" }} />
              <button onClick={fetchProducts} disabled={loading} className="px-4 min-h-[40px] rounded-[10px] text-white text-[13px] font-semibold disabled:opacity-50" style={{ background: "#3a5a1e" }}>{loading ? "…" : "Load"}</button>
            </div>
          ) : (
            <span className="hidden sm:inline-flex items-center text-[13px] px-3 py-2 rounded-[10px] border bg-white text-zinc-700" style={{ borderColor: "#e9e4d6" }}>{projectContext?.name ?? domain}</span>
          )}
          <span
            className="hidden md:inline-flex items-center gap-1.5 text-[12px] px-2.5 py-1.5 rounded-full border"
            style={{ borderColor: headerSaved ? "#bbd39e" : "#e9e4d6", background: headerSaved ? "#f0f7e8" : "#fff" }}
            title={headerSaved ? "All changes saved" : "Unsaved changes"}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: headerSaved ? "#3a5a1e" : "#d97706" }} />
            {saving ? "Saving…" : headerSaved ? "Saved ✓" : "Unsaved"}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={exportJson} className="hidden lg:inline-flex px-4 min-h-[40px] items-center border rounded-[10px] text-[13px] bg-white hover:border-zinc-500" style={{ borderColor: "#e9e4d6" }}>JSON</button>
            <button
              onClick={saveToServer}
              disabled={saving || headerSaved || saveError?.retryable === false}
              className="px-4 min-h-[40px] border rounded-[10px] text-[13px] font-semibold disabled:opacity-60 bg-white"
              style={{ borderColor: headerSaved ? "#bbd39e" : "#191712", background: headerSaved ? "#f0f7e8" : "#fff", color: "#191712" }}
            >
              {saving ? "Saving…" : headerSaved ? "Saved ✓" : saveError?.retryable ? "Retry save" : saveError ? "Reload required" : savedTemplate ? "Save changes" : "Save to Server"}
            </button>
            <button onClick={handleExportPng} className="px-5 min-h-[44px] rounded-[10px] text-sm font-bold text-white flex items-center gap-2" style={{ background: "#3a5a1e" }}>
              <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4" aria-hidden="true">
                <path d="M8 1.5v8.5m0 0L5 7M8 10l3-3M2.5 12.5v1a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Export PNG
            </button>
          </div>
        </div>
        <div className="max-w-[1600px] mx-auto px-4 pb-2 flex items-center gap-2 text-[11px] text-zinc-400">
          {templateIdParam && !projectId && (
            <span>Homepage slot → saving updates the hero · <Link href="/admin" className="underline underline-offset-2">back to Admin</Link></span>
          )}
          {process.env.NODE_ENV !== 'production' && <a href="/story-map" className="ml-auto text-[11px] px-2 py-1 rounded-full text-zinc-400 hover:text-zinc-600">Story Map</a>}
        </div>
      </header>

      {projectError && <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-sm text-red-800">{projectError}</div>}
      {agentWorkspaceContext && agentCatalogSnapshot && agentDesignSnapshot && (
        <AgentWorkspaceProvider
          key={agentWorkspaceContext.projectId}
          context={agentWorkspaceContext}
          catalog={agentCatalogSnapshot}
          design={agentDesignSnapshot}
          onApplyDesign={applyAgentDesign}
          onSetView={applyAgentView}
          onPreviewDesign={applyAgentPreview}
          onHighlightLayers={setAgentHighlightedLayerIds}
        />
      )}
      {webmcpProbeEnabled && projectId && <WebmcpSpike projectId={projectId} template={active} onSetBackground={setProbeBackground} />}
      {saveError && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-sm text-red-800 flex items-center gap-3">
          <span>{saveError.message} Your draft remains in the editor.</span>
          {saveError.retryable && <button onClick={saveToServer} disabled={saving} className="ml-auto px-3 py-1 border border-red-300 bg-white rounded text-xs">Retry save</button>}
        </div>
      )}
      {!isSaved && savedTemplate && !saveError && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-sm text-amber-900">
          Unsaved changes — save this revision before using its server PNG or enriched feed.
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        {/* Left rail + contextual panel */}
        <div className="hidden lg:flex shrink-0 min-h-0" style={{ background: "#fdfcf8" }}>
          <nav aria-label="Primary" className="w-[76px] border-r flex flex-col items-stretch py-3 gap-1 shrink-0" style={{ borderColor: "#e9e4d6" }}>
            {([
              { id: "design", label: "Design", glyph: (<svg viewBox="0 0 16 16" fill="none" className="w-5 h-5" aria-hidden="true"><path d="M3.5 12.5 11 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><path d="M12.6 1.6c.2 1.5 1.1 2.4 2.6 2.6-1.5.2-2.4 1.1-2.6 2.6-.2-1.5-1.1-2.4-2.6-2.6 1.5-.2 2.4-1.1 2.6-2.6Z" fill="currentColor" /><path d="M9.4 8.2c.1.9.7 1.5 1.6 1.6-.9.1-1.5.7-1.6 1.6-.1-.9-.7-1.5-1.6-1.6.9-.1 1.5-.7 1.6-1.6Z" fill="currentColor" /></svg>) },
              { id: "products", label: "Products", glyph: (<svg viewBox="0 0 16 16" fill="none" className="w-5 h-5" aria-hidden="true"><path d="M8 1.5 14 4.8v6.4L8 14.5 2 11.2V4.8L8 1.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><path d="M2 4.8 8 8l6-3.2M8 8v6.5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>) },
              { id: "elements", label: "Elements", glyph: (<svg viewBox="0 0 16 16" fill="none" className="w-5 h-5" aria-hidden="true"><path d="M8 2.5v11M2.5 8h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>) },
              { id: "templates", label: "Templates", glyph: (<svg viewBox="0 0 16 16" fill="none" className="w-5 h-5" aria-hidden="true"><rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.5" /><rect x="9" y="1.5" width="5.5" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.5" /><rect x="1.5" y="9" width="5.5" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.5" /><rect x="9" y="9" width="5.5" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.5" /></svg>) },
            ] as const).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setLeftTab(tab.id)}
                aria-pressed={leftTab === tab.id}
                className={`mx-2 min-h-[56px] rounded-[12px] border flex flex-col items-center justify-center gap-1 py-2 text-[12px] font-medium ${leftTab === tab.id ? "text-white" : "bg-white text-zinc-700"}`}
                style={leftTab === tab.id ? { background: "#3a5a1e", borderColor: "#3a5a1e" } : { borderColor: "#e9e4d6" }}
              >
                {tab.glyph}
                {tab.label}
              </button>
            ))}
          </nav>
          <div className="w-[300px] border-r flex-col shrink-0 hidden lg:flex min-h-0 min-w-0" style={{ borderColor: "#e9e4d6", background: "#fdfcf8" }}>
            {leftTab === "design" && (
              <LayersPanel
                template={active}
                selectedId={selectedId}
                highlightedIds={agentHighlightedLayerIds}
                onSelect={selectLayer}
                onUpdate={(t) => updateActive(t)}
                onAdd={addLayer}
                onDelete={deleteLayer}
                onDuplicate={duplicateLayer}
              />
            )}
            {leftTab === "products" && (
              <div className="flex flex-col flex-1 min-h-0 overflow-y-auto p-4 gap-3">
                <div>
                  <div className="text-[15px] font-semibold">Products</div>
                  <div className="text-[12px] text-zinc-500">Pick a product to preview in your creative.</div>
                </div>
                <div className="flex-1 overflow-auto space-y-2">
                  {products.slice(0, 50).map((p, idx) => (
                    <button
                      key={p.id}
                      onClick={() => selectProduct(idx)}
                      className="w-full min-h-[56px] flex items-center gap-3 p-2 rounded-[12px] border bg-white text-left"
                      style={{ borderColor: idx === productIdx ? "#3a5a1e" : "#e9e4d6", background: idx === productIdx ? "#f3f6ec" : "#fff" }}
                    >
                      {p.image_link ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.image_link} alt="" className="w-10 h-10 rounded-[10px] object-cover bg-zinc-100 shrink-0" />
                      ) : (
                        <span className="w-10 h-10 rounded-[10px] bg-zinc-100 flex items-center justify-center text-[11px] shrink-0">—</span>
                      )}
                      <span className="flex-1 min-w-0">
                        <span className="block truncate text-[13px] font-medium">{p.title}</span>
                        <span className="block text-[12px] text-zinc-500 font-mono">{p.price}</span>
                      </span>
                    </button>
                  ))}
                  {products.length === 0 && <span className="text-[12px] text-zinc-500">No products — load a store above.</span>}
                </div>
                <div className="text-[11px] text-zinc-400">{products.length ? `${productIdx + 1} / ${products.length} selected` : "0 products"}</div>
              </div>
            )}
            {leftTab === "elements" && (
              <div className="flex flex-col flex-1 min-h-0 overflow-y-auto p-4 gap-3">
                <div>
                  <div className="text-[15px] font-semibold">Elements</div>
                  <div className="text-[12px] text-zinc-500">Add text, badges, and shapes to your creative.</div>
                </div>
                <button onClick={() => addLayer("text")} className="w-full min-h-[48px] rounded-[12px] border bg-white text-[14px] font-medium" style={{ borderColor: "#e9e4d6" }}>＋ Add text</button>
                <button onClick={() => addLayer("badge")} className="w-full min-h-[48px] rounded-[12px] text-[14px] font-semibold text-white" style={{ background: "#3a5a1e" }}>＋ Add badge</button>
                <button onClick={() => addLayer("shape")} className="w-full min-h-[48px] rounded-[12px] border bg-white text-[14px] font-medium" style={{ borderColor: "#e9e4d6" }}>＋ Add shape</button>
                <div className="text-[11px] text-zinc-400">Tip: drag on canvas to move, corners to resize. {"{{price}}"} updates per product.</div>
              </div>
            )}
            {leftTab === "templates" && (
              <div className="flex flex-col flex-1 min-h-0 overflow-y-auto p-4 gap-3">
                <div>
                  <div className="text-[15px] font-semibold">Templates</div>
                  <div className="text-[12px] text-zinc-500">Pick a starting point — your product fills in automatically.</div>
                </div>
                {starterPreviews.map(({ id, name, blurb, preview }) => {
                  const thumbScale = 236 / preview.width;
                  return (
                    <div key={id} className="rounded-[12px] border bg-white p-2.5" style={{ borderColor: "#e9e4d6" }}>
                      <div className="border overflow-hidden rounded-[10px] mx-auto" style={{ borderColor: "#e9e4d6", width: preview.width * thumbScale, height: preview.height * thumbScale }}>
                        <TemplateRenderer template={preview} product={product} scale={thumbScale} />
                      </div>
                      <div className="mt-2 text-[13px] font-semibold">{name}</div>
                      <div className="text-[12px] text-zinc-500">{blurb}</div>
                      <button onClick={() => applyStarter(id)} className="mt-2 w-full min-h-[44px] rounded-[10px] text-[13px] font-semibold text-white" style={{ background: "#3a5a1e" }}>
                        Use this design
                      </button>
                    </div>
                  );
                })}
                <div className="text-[11px] text-zinc-400">Applying replaces the current design. Unsaved changes ask first.</div>
              </div>
            )}
          </div>
        </div>

        {/* Center canvas */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0" style={{ background: "#f4f1ea" }}>
          {/* Canvas stage — toolbar hovers over the canvas, no top padding */}
          <div className="relative flex-1 min-h-0 overflow-hidden">
            <div className="absolute top-3 left-4 right-4 z-10 flex items-center gap-2 pointer-events-none">
              <div className="pointer-events-auto relative">
                <button
                  onClick={() => setSizesOpen((open) => !open)}
                  aria-expanded={sizesOpen}
                  aria-haspopup="true"
                  title="Choose which sizes are visible on the canvas"
                  className="flex items-center gap-2 bg-white/80 backdrop-blur border rounded-[12px] pl-3 pr-3 py-1.5 shadow-sm min-h-[52px] text-[13px] font-medium"
                  style={{ borderColor: "#e9e4d6" }}
                >
                  Sizes · {visibleSizes.length}
                  <span className="text-zinc-400 text-[11px]" aria-hidden="true">{sizesOpen ? "▲" : "▼"}</span>
                </button>
                {sizesOpen && (
                  <>
                    <div
                      className="pointer-events-auto fixed inset-0 z-10"
                      onClick={() => setSizesOpen(false)}
                      onPointerDown={(e) => e.stopPropagation()}
                      aria-hidden="true"
                    />
                    <div
                      className="absolute left-0 top-full mt-2 z-20 w-[260px] rounded-[12px] border bg-white/95 backdrop-blur shadow-lg p-1.5"
                      style={{ borderColor: "#e9e4d6" }}
                      role="menu"
                      aria-label="Visible sizes"
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      {SIZE_PRESETS.map((s) => {
                        const sizeId = s.id as SizePresetId;
                        const checked = visibleSizes.includes(sizeId);
                        const isLast = checked && visibleSizes.length === 1;
                        return (
                          <label
                            key={s.id}
                            className={`flex items-center gap-2.5 px-2.5 py-2 rounded-[10px] text-[13px] ${isLast ? "opacity-50" : "cursor-pointer hover:bg-zinc-100"}`}
                            title={isLast ? "At least one size must stay visible" : undefined}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={isLast}
                              onChange={() => {
                                setVisibleSizes((prev) => {
                                  const next = prev.includes(sizeId)
                                    ? prev.filter((id) => id !== sizeId)
                                    : SIZE_PRESET_IDS.filter((id) => id === sizeId || prev.includes(id));
                                  return next.length > 0 ? next : prev;
                                });
                                dispatchWorkspaceRevision({ type: "view-changed", actor: "human" });
                              }}
                              className="w-4 h-4 accent-[#3a5a1e]"
                            />
                            <span className="font-medium">{s.label}</span>
                          </label>
                        );
                      })}
                      <div className="flex gap-2 mt-1 pt-1.5 border-t" style={{ borderColor: "#e9e4d6" }}>
                        <button
                          onClick={() => setVisibleSizes([...SIZE_PRESET_IDS])}
                          className="flex-1 py-1.5 text-[12px] rounded-[8px] hover:bg-zinc-100 text-zinc-600"
                        >
                          Show all
                        </button>
                        <button
                          onClick={() => setVisibleSizes(["1:1", "4:5", "9:16"])}
                          className="flex-1 py-1.5 text-[12px] rounded-[8px] hover:bg-zinc-100 text-zinc-600"
                        >
                          Reset default
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
              {editingVariantSize && (
                <button
                  onClick={backToMaster}
                  title="Return to the master template"
                  className="pointer-events-auto px-4 min-h-[40px] rounded-[10px] border text-[13px] bg-white/80 backdrop-blur shadow-sm"
                  style={{ borderColor: "#e9e4d6" }}
                >
                  ← Master
                </button>
              )}
              <button onClick={() => setShowJson(!showJson)} className={`pointer-events-auto px-4 min-h-[40px] rounded-[10px] border text-[13px] bg-white/80 backdrop-blur shadow-sm ${showJson ? "font-semibold" : ""}`} style={{ borderColor: "#e9e4d6" }}>JSON</button>
            </div>

          {agentReview ? (
            <div className="absolute inset-0 overflow-auto pt-16 flex flex-col">
              <AgentReviewGrid review={agentReview} products={products} onClose={closeAgentReview} />
            </div>
          ) : (
            <div className="absolute inset-0 overflow-hidden">
              <AllSizesCanvas
                sheets={allSizesSheets}
                product={product}
                scale={scale}
                activeId={activeId}
                selectedId={selectedId}
                onScaleChange={setScale}
                onActivateSheet={activateSheet}
                onUpdateSheet={updateTemplateById}
                onResetSheet={resetVariant}
              />
              {saveNotice && (
                <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 z-10 text-[11px] px-3 py-1.5 bg-green-100 border border-green-200 rounded-full whitespace-nowrap">
                  {saveNotice}
                </div>
              )}
            </div>
          )}
          </div>

          {/* Hidden export node at 1:1 scale for raster */}
          <div ref={exportRef} className="fixed left-[-9999px] top-0">
            <TemplateRenderer template={active} product={product} scale={1} />
          </div>
        </div>

        {/* Right properties */}
        <div className="w-[320px] border-l hidden xl:block shrink-0 overflow-auto min-h-0" style={{ borderColor: "#e9e4d6", background: "#fdfcf8" }}>
          <PropertiesPanel
            template={active}
            selectedId={selectedId}
            onUpdateTemplate={(patch) => updateActive({ ...active, ...patch })}
            onUpdateLayer={updateLayer}
          />
          {showJson && (
            <div className="border-t p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">Template JSON (AI-friendly)</span>
                <button
                  onClick={() => navigator.clipboard.writeText(JSON.stringify(active, null, 2))}
                  className="text-xs px-2.5 py-1 border rounded-full bg-white"
                  style={{ borderColor: "#e9e4d6" }}
                >
                  Copy
                </button>
              </div>
              <textarea
                value={JSON.stringify(active, null, 2)}
                readOnly
                rows={12}
                className="w-full border rounded-2xl p-2.5 font-mono text-[11px]"
                style={{ borderColor: "#e9e4d6", background: "#f6f2e8" }}
              />
              <div className="text-[11px] text-zinc-500">Agents: edit this JSON and paste below to import. Bindings: {`{{title}} {{price}} {{discount_pct}} {{vendor}}`}</div>
              <textarea
                placeholder="Paste AI-returned JSON here then press Import"
                rows={4}
                className="w-full border rounded-2xl p-2.5 font-mono text-xs bg-white"
                style={{ borderColor: "#e9e4d6" }}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") importJson((e.target as HTMLTextAreaElement).value);
                }}
                id="import-json"
              />
              <button onClick={() => importJson((document.getElementById("import-json") as HTMLTextAreaElement)?.value ?? "")} className="w-full py-2 text-white rounded-full text-xs font-semibold" style={{ background: "#191712" }}>Import JSON</button>
            </div>
          )}
        </div>
      </div>

      {/* Feed + template footer zone — capped so the workspace keeps the viewport */}
      <div className="shrink-0 overflow-y-auto max-h-[28vh] min-h-0">
      {/* Mobile layers/properties drawers */}
      <div className="lg:hidden border-t p-3 flex gap-2 overflow-auto text-xs bg-white" style={{ borderColor: "#e9e4d6" }}>
        <span className="font-medium">Tip:</span> Open on desktop for full layers + properties.
      </div>

      {/* Published feed bar (project mode) or enriched feed bar (legacy mode) */}
      {projectId ? (
        publication !== undefined && (
          <div className="bg-violet-50 border-t border-violet-200 px-4 py-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-violet-900">Published Feed</span>
              {publication?.active ? (
                <span className="text-xs px-2 py-0.5 bg-violet-600 text-white rounded-full">
                  Live: rev {publication.active.projectRevision} · {new Date(publication.active.publishedAt).toLocaleString()}
                </span>
              ) : (
                <span className="text-xs px-2 py-0.5 bg-zinc-200 text-zinc-700 rounded-full">
                  {publication === null ? "Publication status unavailable" : "Not published yet"}
                </span>
              )}
              {projectValidation && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${projectValidation.status === "blocked" ? "bg-red-600 text-white" : projectValidation.status === "needs-review" ? "bg-amber-400 text-amber-950" : "bg-green-600 text-white"}`}>
                  Catalog: {projectValidation.status === "blocked" ? "blocked" : projectValidation.status === "needs-review" ? "review needed" : "ready"}
                </span>
              )}
              <button
                onClick={publishProject}
                disabled={publishing || publishBlockedByUnsavedDesign}
                className="ml-auto text-xs px-3 py-1 bg-violet-600 text-white rounded disabled:opacity-50"
              >
                {publishing ? "Publishing…" : publishBlockedByUnsavedDesign ? "Save changes first" : publication?.active ? "Republish" : "Publish"}
              </button>
            </div>
            {publication?.active ? (
              <>
                <code className="block text-xs font-mono bg-white border rounded px-3 py-2 break-all">{`${typeof window !== "undefined" ? window.location.origin : ""}/api/feed?projectId=${projectId}`}</code>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/api/feed?projectId=${projectId}`);
                      alert("Published feed URL copied — keep it private, it works as a share link for Meta");
                    }}
                    className="text-xs px-3 py-1 bg-violet-600 text-white rounded"
                  >
                    Copy Published Feed URL
                  </button>
                  <a
                    href={`/api/feed?projectId=${encodeURIComponent(projectId)}`}
                    target="_blank"
                    className="text-xs px-3 py-1 border bg-white rounded"
                  >
                    Download CSV
                  </a>
                  {projectRevision > publication.active.projectRevision && (
                    <span className="text-[11px] text-amber-700">Draft changed since publication — republish to update the live feed.</span>
                  )}
                </div>
              </>
            ) : (
              <div className="text-[11px] text-violet-700">Publishing freezes the current products, validation, and design into a stable feed URL. Saving a draft never changes the live feed.</div>
            )}
            {publication?.lastAttempt?.status === "failed" && (
              <div className="text-[11px] text-amber-700">
                Last publish failed: {publication.lastAttempt.error?.message ?? "unknown error"} The live feed was preserved.
              </div>
            )}
            {publishBlockedByUnsavedDesign && (
              <div className="text-[11px] text-amber-700">
                Save the master design and any open placement drafts before publishing, so the live feed matches what you reviewed.
              </div>
            )}
            {(() => {
              const ids = publication?.active?.skippedProductIds ?? [];
              if (ids.length === 0) return null;
              return (
                <div className="text-[11px] text-amber-700">
                  Live feed skips {ids.length} invalid product{ids.length === 1 ? "" : "s"}: {ids.join(", ")}. Fix them in the source and republish to include them.
                </div>
              );
            })()}
            <div className="text-[11px] text-violet-700">Treat this URL like a private share link — project IDs are unguessable, no login needed for Meta. Publishing does not submit anything to Meta; import the URL as a catalog data source yourself.</div>
          </div>
        )
      ) : (
        savedId && (
        <div className="bg-violet-50 border-t border-violet-200 px-4 py-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-violet-900">Enriched Feed (server raster)</span>
            <span className="text-xs px-2 py-0.5 bg-violet-600 text-white rounded-full">Saved: {savedId}</span>
            {projectValidation && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${projectValidation.status === "blocked" ? "bg-red-600 text-white" : projectValidation.status === "needs-review" ? "bg-amber-400 text-amber-950" : "bg-green-600 text-white"}`}>
                Catalog: {projectValidation.status === "blocked" ? "blocked" : projectValidation.status === "needs-review" ? "review needed" : "ready"}
              </span>
            )}
            <button
              onClick={() => {
                const target = projectId ? `projectId=${encodeURIComponent(projectId)}` : `domain=${encodeURIComponent(domain)}`;
                const url = `${window.location.origin}/api/feed?${target}&templateId=${encodeURIComponent(savedId)}`;
                navigator.clipboard.writeText(url);
                alert("Enriched feed URL copied — keep it private, it works as a share link for Meta");
              }}
              className="ml-auto text-xs px-3 py-1 bg-violet-600 text-white rounded"
            >
              Copy Enriched Feed URL
            </button>
            <a
              href={`/api/feed?${projectId ? `projectId=${encodeURIComponent(projectId)}` : `domain=${encodeURIComponent(domain)}`}&templateId=${encodeURIComponent(savedId)}`}
              target="_blank"
              className="text-xs px-3 py-1 border bg-white rounded"
            >
              Download CSV
            </a>
          </div>
          <code className="block text-xs font-mono bg-white border rounded px-3 py-2 break-all">{`${typeof window !== "undefined" ? window.location.origin : ""}/api/feed?${projectId ? `projectId=${projectId}` : `domain=${domain}`}&templateId=${savedId}`}</code>
          <div className="text-[11px] text-violet-700">Feed images use the exact product variant. {productRenderUrl && <a href={productRenderUrl} target="_blank" className="underline">Preview current product PNG</a>}</div>
          <div className="text-[11px] text-violet-700">Treat this URL like a private share link — template IDs are unguessable, no login needed for Meta.</div>
          </div>
        )
      )}

      </div>
    </div>
  );
}
