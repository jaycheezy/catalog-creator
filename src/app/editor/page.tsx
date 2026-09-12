"use client";

import { useCallback, useEffect, useState, useMemo, useReducer, useRef } from "react";
import "@fontsource/inter/400.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import { TemplateRenderer } from "@/editor/TemplateRenderer";
import { EditorCanvas } from "@/editor/EditorCanvas";
import { LayersPanel } from "@/editor/LayersPanel";
import { PropertiesPanel } from "@/editor/PropertiesPanel";
import { createDefaultTemplate, SIZE_PRESETS, TEMPLATE_JSON_SCHEMA } from "@/editor/types";
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
  promotePlacementToMaster,
  summarizeVariantSaves,
  variantDraftId,
  type VariantSaveResult,
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

export default function EditorPage() {
  const router = useRouter();
  // Resolved after hydration so the server and client first render agree.
  // Null means the query string has not been read yet; no loading starts.
  const [projectId, setProjectId] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProjectId(new URLSearchParams(window.location.search).get("projectId") || "");
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
  const [aiPrompt, setAiPrompt] = useState("");
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
  const [showAllSizes, setShowAllSizes] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<{ message: string; retryable: boolean } | null>(null);
  const [agentHighlightedLayerIds, setAgentHighlightedLayerIds] = useState<string[]>([]);
  const [agentReview, setAgentReview] = useState<WorkspaceReviewState | null>(null);
  const exportRef = useRef<HTMLDivElement>(null);

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

  // Load from localStorage
  useEffect(() => {
    if (projectId === null || projectId) return;
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

  const toggleAllSizes = () => {
    if (agentReview) {
      setAgentReview(null);
      setShowAllSizes(false);
    } else {
      setShowAllSizes((visible) => !visible);
    }
    dispatchWorkspaceRevision({ type: "view-changed", actor: "human" });
  };

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

  const changeSize = (sizeId: string) => {
    if (editingVariantSize) return;
    const targetSize = sizeId as SizePresetId;
    const promoted = promotePlacementToMaster(
      master,
      SIZE_PRESETS,
      targetSize,
      variantEntry(targetSize),
      placementSnapshots[targetSize],
    );
    // The selected placement now is the master. Remove its duplicate draft so
    // the canvas, card, and save-all candidate share one durable owner.
    setTemplates((prev) => prev
      .filter((template) => template.id !== variantDraftId(targetSize))
      .map((template) => (template.id === master.id ? promoted : template)));
    setActiveId(master.id);
    selectLayer(null);
    markHumanDraftChange();
  };

  const variantEntry = (sizeId: SizePresetId): Template | undefined =>
    templates.find((t) => t.id === variantDraftId(sizeId));

  /**
   * Open one placement as an independent draft. Other placements keep
   * rendering from the master draft, so editing here stales only this card.
   */
  const openVariant = (sizeId: SizePresetId) => {
    const existing = variantEntry(sizeId);
    if (existing) {
      setActiveId(existing.id);
      selectLayer(null);
      return;
    }
    const preset = SIZE_PRESETS.find((p) => p.id === sizeId) ?? SIZE_PRESETS[0];
    const base = placementSnapshots[sizeId] ?? (sizeId === master.sizeId ? master : adaptTemplateToSize(master, preset));
    const draftId = variantDraftId(sizeId);
    setTemplates((prev) => {
      if (prev.some((t) => t.id === draftId)) return prev;
      // Keep the base name: renaming the draft would make the saved snapshot
      // look stale against a fresh adaptation after reloading.
      const draft: Template = { ...base, id: draftId, updatedAt: Date.now() };
      return [...prev, draft];
    });
    setActiveId(draftId);
    selectLayer(null);
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
          mode: showAllSizes ? "all-sizes" : "canvas",
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
    showAllSizes,
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
    if (change.panel !== undefined) {
      setAgentReview(null);
      setShowAllSizes(change.panel === "all-sizes");
    }
    dispatchWorkspaceRevision({ type: "view-changed", actor: "agent" });
  }, []);

  const applyAgentPreview = useCallback((review: WorkspaceReviewState) => {
    setAgentReview(review);
    setShowAllSizes(true);
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

  const saveToServer = async () => {
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
  };

  /**
   * Save one variant per placement. Project mode is a single atomic PATCH:
   * the server validates all four before writing, so a failure retains every
   * draft and prior saved record. Legacy standalone mode keeps separate
   * template writes and reports the exact per-placement outcome.
   */
  const saveAllVariants = async () => {
    // Candidates follow the same lineage the cards display: open drafts,
    // live master, saved snapshots, then fresh adaptations. What you see is
    // what gets persisted; untouched customizations are never silently
    // replaced by a master adaptation.
    const candidates = SIZE_PRESET_IDS.map((sizeId) => ({
      sizeId,
      variant: placementView(master, SIZE_PRESETS, sizeId, variantEntry(sizeId), placementSnapshots[sizeId]),
    }));
    setSaving(true);
    setSaveError(null);
    setSaveNotice(null);
    try {
      if (projectId) {
        const placementTemplates: Record<string, unknown> = {};
        for (const { sizeId, variant } of candidates) placementTemplates[sizeId] = variant;
        const res = await fetch("/api/projects", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          // Persist the master draft as the active template in the same
          // atomic write so reopening restores the latest design, not the
          // older active template.
          body: JSON.stringify({ id: projectId, template: master, placementTemplates, expectedRevision: projectRevision }),
        });
        const json = await res.json() as {
          error?: string;
          retryable?: boolean;
          revision?: number;
          templateId?: string;
          templateRevision?: number;
          variants?: { sizeId: string; templateId: string; templateRevision: number; width: number; height: number }[];
        };
        if (res.status === 401) {
          router.push(`/login?next=${encodeURIComponent(`/editor${window.location.search}`)}`);
          return;
        }
        if (!res.ok) {
          setSaveError({ message: json.error || "Could not save every size.", retryable: json.retryable !== false });
          return;
        }
        const returned = new Map((json.variants ?? []).map((variant) => [variant.sizeId, variant]));
        const next: Partial<Record<SizePresetId, SavedTemplateRecord>> = {};
        for (const { sizeId, variant } of candidates) {
          const confirmed = returned.get(sizeId);
          if (!confirmed) {
            setSaveError({ message: `The server did not confirm placement ${sizeId}. Nothing was marked saved.`, retryable: true });
            return;
          }
          next[sizeId] = {
            templateId: confirmed.templateId,
            fingerprint: placementFingerprint(variant),
            revision: confirmed.templateRevision,
          };
        }
        setSavedPlacements(next);
        setPlacementSnapshots(Object.fromEntries(candidates.map(({ sizeId, variant }) => [sizeId, { ...variant }])) as Partial<Record<SizePresetId, Template>>);
        setProjectRevision(Number(json.revision ?? projectRevision));
        const masterRevision = Number(json.templateRevision ?? 0);
        setSavedTemplates((previous) => ({
          ...previous,
          [master.id]: {
            templateId: json.templateId || master.id,
            fingerprint: templateFingerprint(master),
            revision: masterRevision,
          },
        }));
        setTemplates((prev) => prev.map((t) => (t.id === master.id ? { ...t, revision: masterRevision } : t)));
        setSaveNotice(`Saved all 4 placements (project revision ${Number(json.revision ?? projectRevision)}).`);
        return;
      }
      const results: VariantSaveResult[] = [];
      const next: Partial<Record<SizePresetId, SavedTemplateRecord>> = { ...savedPlacements };
      for (const { sizeId, variant } of candidates) {
        const toSave = { ...variant, id: undefined };
        try {
          const res = await fetch("/api/templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(toSave) });
          const json = await res.json() as { error?: string; templateId?: string; id?: string; revision?: number };
          if (res.status === 401) {
            router.push(`/login?next=${encodeURIComponent(`/editor${window.location.search}`)}`);
            return;
          }
          if (!res.ok) throw new Error(json.error || `Could not save ${sizeId}`);
          const savedTemplateId = json.templateId || json.id;
          if (!savedTemplateId) throw new Error(`No template id returned for ${sizeId}`);
          next[sizeId] = {
            templateId: savedTemplateId,
            fingerprint: placementFingerprint(variant),
            revision: Number(json.revision ?? 0),
          };
          results.push({ sizeId, ok: true });
        } catch (error) {
          results.push({ sizeId, ok: false, error: error instanceof Error ? error.message : String(error) });
        }
      }
      setSavedPlacements(next);
      const summary = summarizeVariantSaves(results);
      if (summary.failed.length === 0) {
        const bySize = new Map(candidates.map((candidate) => [candidate.sizeId, candidate.variant]));
        setPlacementSnapshots((prev) => {
          const copy = { ...prev };
          for (const { sizeId } of candidates) copy[sizeId] = { ...(bySize.get(sizeId) as Template) };
          return copy;
        });
        setSaveNotice(`Saved all ${summary.succeeded.length} size variants as separate templates. List via /api/templates?list=1`);
      } else {
        setSaveError({
          message: `Saved ${summary.succeeded.length} of ${results.length}: ${summary.failed.map((failure) => `${failure.sizeId} (${failure.error})`).join(", ")}. Saved placements kept their links; retry the failed sizes.`,
          retryable: true,
        });
      }
    } catch (error) {
      setSaveError({ message: error instanceof Error ? error.message : "Could not save every size.", retryable: true });
    } finally {
      setSaving(false);
    }
  };

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

  const handleAiAssist = () => {
    // For AI agents: copy JSON schema + current template + prompt into clipboard, simulate agent generation
    // MVP: generate a simple variant locally based on prompt keywords
    const p = aiPrompt.toLowerCase();
    let patch: Partial<Template> = {};
    if (p.includes("sale") || p.includes("badge") || p.includes("discount")) {
      const badge: Layer = {
        id: `layer_${Math.random().toString(36).slice(2, 7)}`,
        type: "badge",
        name: "Sale Badge",
        x: 80,
        y: 80,
        w: 220,
        h: 56,
        rotation: -8,
        z: 10,
        visible: true,
        locked: false,
        style: { background: "#dc2626", color: "#fff", fontSize: 28, fontWeight: 800, borderRadius: 12, textAlign: "center", textTransform: "uppercase" },
        content: "{{discount_pct}}% OFF",
      };
      updateActive({ ...active, layers: [...active.layers, badge] });
      setAiPrompt("");
      return;
    }
    if (p.includes("minimal") || p.includes("clean")) {
      patch = { background: "#ffffff", layers: active.layers.map((l) => ({ ...l, style: { ...l.style, background: l.type === "product-image" ? "#ffffff" : l.style.background } })) } as Partial<Template>;
      updateActive(patch as Template);
      setAiPrompt("");
      return;
    }
    if (p.includes("dark") || p.includes("premium")) {
      patch = {
        background: "#0a0a0a",
        layers: active.layers.map((layer) => layer.id === "layer_title"
          ? { ...layer, style: { ...layer.style, color: "#fafafa" } }
          : layer),
      };
      updateActive({ ...active, ...patch });
      setAiPrompt("");
      return;
    }
    // fallback: copy schema + template to clipboard for real AI agent
    const payload = `You are a CatalogForge AI designer. Edit this Template JSON per instruction.\n\nSCHEMA: ${JSON.stringify(TEMPLATE_JSON_SCHEMA, null, 2)}\n\nTEMPLATE: ${JSON.stringify(active, null, 2)}\n\nINSTRUCTION: ${aiPrompt}\n\nReturn only valid JSON matching schema. Bindings allowed: {{title}}, {{price}}, {{discount_pct}}, {{vendor}}.`;
    navigator.clipboard.writeText(payload);
    alert("Prompt + schema + template copied to clipboard. Paste to your AI agent (ChatGPT/Claude) and paste returned JSON via 'Import JSON'.");
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
    <div className="min-h-screen bg-zinc-50 text-zinc-900 flex flex-col">
      <header className="border-b bg-white sticky top-0 z-20">
        <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/" className="font-semibold tracking-tight">Catalog Forge</Link>
          <span className="text-zinc-300">/</span>
          <span className="text-sm font-medium">Editor (HTML)</span>
          {process.env.NODE_ENV !== 'production' && <a href="/story-map" className="ml-2 text-xs px-2 py-1 border rounded">Story Map</a>}
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 text-xs">
              <span className="text-zinc-500">{projectId ? "Source" : "Domain"}</span>
              <input value={domain} onChange={(e) => setDomain(e.target.value)} disabled={Boolean(projectId)} className="border rounded px-2 py-1 font-mono text-xs w-44 disabled:bg-zinc-50" />
              {!projectId && <button onClick={fetchProducts} disabled={loading} className="px-3 py-1 bg-zinc-900 text-white rounded text-xs disabled:opacity-50">{loading ? "..." : "Load"}</button>}
            </div>
            <select
              value={active.sizeId}
              onChange={(e) => changeSize(e.target.value)}
              disabled={Boolean(editingVariantSize)}
              title={editingVariantSize ? "Return to the master before switching its size" : "Switch the master size"}
              className="border rounded px-2 py-1 text-xs disabled:opacity-50"
            >
              {SIZE_PRESETS.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
            <button onClick={toggleAllSizes} className={`px-2 py-1 border rounded text-xs ${showAllSizes ? "bg-violet-600 text-white" : "bg-white"}`}>{showAllSizes ? "Single" : "All sizes"}</button>
            <div className="flex items-center gap-1 border rounded px-2 py-1 text-xs">
              <button onClick={() => setScale((s) => Math.max(0.2, s - 0.05))} className="px-1">−</button>
              <span className="font-mono w-10 text-center">{Math.round(scale * 100)}%</span>
              <button onClick={() => setScale((s) => Math.min(1, s + 0.05))} className="px-1">+</button>
            </div>
            <button onClick={exportJson} className="hidden sm:inline-flex px-3 py-1.5 border rounded text-xs">Export JSON</button>
            <button
              onClick={saveToServer}
              disabled={saving || headerSaved || saveError?.retryable === false}
              className={`px-3 py-1.5 border rounded text-xs disabled:opacity-70 ${headerSaved ? "bg-green-50 border-green-300 text-green-800" : "bg-white"}`}
            >
              {saving ? "Saving…" : headerSaved ? "Saved ✓" : saveError?.retryable ? "Retry save" : saveError ? "Reload required" : savedTemplate ? "Save changes" : "Save to Server"}
            </button>
            <button onClick={handleExportPng} className="px-3 py-1.5 bg-zinc-900 text-white rounded text-xs">Export PNG</button>
          </div>
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
        {/* Left layers */}
        <div className="w-[280px] border-r bg-white hidden lg:flex flex-col shrink-0">
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
        </div>

        {/* Center canvas */}
        <div className="flex-1 flex flex-col min-w-0 bg-zinc-100">
          {editingVariantSize && (
            <div className="bg-amber-50 border-b px-4 py-1.5 flex gap-2 items-center text-xs">
              <span>Editing the {editingVariantSize} variant independently — other placements are unaffected.</span>
              <button onClick={backToMaster} className="ml-auto px-2 py-1 border rounded bg-white">Back to master</button>
            </div>
          )}
          {/* AI assist bar */}
          <div className="bg-white border-b px-4 py-2 flex gap-2 items-center">
            <span className="text-xs font-medium shrink-0">AI Assist</span>
            <input
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder='Try: "add red sale badge" or "make dark premium" or describe any design'
              className="flex-1 border rounded px-3 py-1.5 text-sm"
            />
            <button onClick={handleAiAssist} className="px-3 py-1.5 bg-violet-600 text-white rounded text-xs font-medium">Generate</button>
            <button onClick={() => setShowJson(!showJson)} className="px-3 py-1.5 border rounded text-xs">{showJson ? "Hide JSON" : "Copy JSON"}</button>
          </div>

          {showAllSizes && agentReview ? (
            <AgentReviewGrid review={agentReview} products={products} onClose={closeAgentReview} />
          ) : showAllSizes ? (
            <div className="flex-1 overflow-auto p-4 bg-zinc-100">
              <div className="text-xs text-zinc-600 mb-3 flex items-center gap-2">
                <span>Auto-layout preview — same design adapted to every placement. Bottom-anchored title/price stay fixed, product image stretches.</span>
                <button
                  onClick={saveAllVariants}
                  disabled={saving}
                  className="ml-auto text-[11px] px-2 py-1 bg-zinc-900 text-white rounded"
                >
                  Save all 4 variants
                </button>
                {saveNotice && <span className="text-[11px] px-2 py-0.5 bg-green-100 border border-green-200 rounded">{saveNotice}</span>}
                <span className="text-[11px] px-2 py-0.5 bg-green-100 border border-green-200 rounded">Active: {active.sizeId} is master</span>
              </div>
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                {SIZE_PRESETS.map((preset) => {
                  const sizeId = preset.id as SizePresetId;
                  const entry = variantEntry(sizeId);
                  const snapshot = placementSnapshots[sizeId];
                  const variant = placementView(master, SIZE_PRESETS, sizeId, entry, snapshot);
                  const previewScale = preset.id === "9:16" ? 0.22 : preset.id === "4:5" ? 0.26 : preset.id === "1.91:1" ? 0.24 : 0.28;
                  const placementRecord = savedPlacements[sizeId];
                  const placementSaved = isPlacementSaved(master, SIZE_PRESETS, sizeId, placementRecord?.fingerprint, variant);
                  const placementPng = placementSaved && placementRecord && product
                    ? projectId
                      ? previewRenderLink(placementRecord.templateId)
                      : buildRenderUrl(placementRecord.templateId, domain, product)
                    : null;
                  const isEditingCard = entry ? activeId === entry.id : (!editingVariantSize && preset.id === active.sizeId);
                  const adaptedFresh = sizeId === master.sizeId ? master : adaptTemplateToSize(master, preset);
                  const canReset = !entry && snapshot && sizeId !== master.sizeId
                    && placementFingerprint(snapshot) !== placementFingerprint(adaptedFresh);
                  return (
                    <div key={preset.id} className="bg-white rounded-lg border p-3 flex flex-col items-center">
                      <div className="text-xs font-medium mb-2 flex items-center gap-2">
                        <span>{preset.label}</span>
                        {isEditingCard && <span className="text-[10px] px-1.5 py-0.5 bg-zinc-900 text-white rounded">editing</span>}
                      </div>
                      <div className="border bg-zinc-50 overflow-hidden" style={{ width: variant.width * previewScale, height: variant.height * previewScale }}>
                        <TemplateRenderer template={variant} product={product} scale={previewScale} />
                      </div>
                      <div className="text-[11px] text-zinc-500 mt-2">{variant.width}×{variant.height}</div>
                      {placementPng ? (
                        <a href={placementPng} target="_blank" className="text-[11px] text-blue-600 underline mt-1">PNG</a>
                      ) : placementRecord ? (
                        <span className="text-[11px] text-amber-700 mt-1">Stale — save again</span>
                      ) : (
                        <span className="text-[11px] text-zinc-400 mt-1">Not saved</span>
                      )}
                      {entry && activeId === entry.id ? (
                        <span className="text-[11px] text-zinc-500 mt-1">Editing this variant</span>
                      ) : sizeId === master.sizeId && !entry ? null : (
                        <button onClick={() => openVariant(sizeId)} className="text-[11px] text-zinc-600 underline mt-1">
                          {entry ? "Resume variant edit" : "Edit this size"}
                        </button>
                      )}
                      {canReset && (
                        <button onClick={() => resetVariant(sizeId)} className="text-[11px] text-zinc-500 underline mt-1">
                          Reset to master
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 text-[11px] text-zinc-500">Tip: Switch the master size via the dropdown — layers keep their distance from bottom (price/badge) and stretch the product image automatically.</div>
            </div>
          ) : (
            <EditorCanvas
              template={active}
              product={product}
              scale={scale}
              selectedId={selectedId}
              onSelect={selectLayer}
              onUpdate={(t) => updateActive(t)}
            />
          )}

          {/* Hidden export node at 1:1 scale for raster */}
          <div ref={exportRef} className="fixed left-[-9999px] top-0">
            <TemplateRenderer template={active} product={product} scale={1} />
          </div>

          {/* Product strip */}
          <div className="bg-white border-t p-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium">Preview product</span>
              <span className="text-xs text-zinc-500">{products.length ? `${productIdx + 1} / ${products.length}` : "No products — load store.gibun.at"}</span>
              <div className="ml-auto flex gap-1">
                <button disabled={productIdx === 0} onClick={() => selectProduct(Math.max(0, productIdx - 1))} className="px-2 py-1 border rounded text-xs disabled:opacity-30">Prev</button>
                <button disabled={productIdx >= products.length - 1} onClick={() => selectProduct(productIdx + 1)} className="px-2 py-1 border rounded text-xs disabled:opacity-30">Next</button>
              </div>
            </div>
            <div className="flex gap-2 overflow-auto pb-1">
              {products.slice(0, 20).map((p, idx) => (
                <button
                  key={p.id}
                  onClick={() => selectProduct(idx)}
                  className={`shrink-0 w-20 border rounded overflow-hidden bg-white ${idx === productIdx ? "ring-2 ring-blue-500" : ""}`}
                  title={p.title}
                >
                  {p.image_link ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image_link} alt="" className="w-full h-20 object-contain bg-zinc-50" />
                  ) : (
                    <div className="w-full h-20 bg-zinc-100 flex items-center justify-center text-[10px] text-zinc-400">No image</div>
                  )}
                  <div className="text-[10px] p-1 truncate text-left">{p.title}</div>
                  <div className="text-[10px] px-1 pb-1 font-mono text-left">{p.price}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right properties */}
        <div className="w-[320px] border-l bg-white hidden xl:block shrink-0 overflow-auto">
          <PropertiesPanel
            template={active}
            selectedId={selectedId}
            onUpdateTemplate={(patch) => updateActive({ ...active, ...patch })}
            onUpdateLayer={updateLayer}
          />
          {showJson && (
            <div className="border-t p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">Template JSON (AI-friendly)</span>
                <button
                  onClick={() => navigator.clipboard.writeText(JSON.stringify(active, null, 2))}
                  className="text-xs px-2 py-1 border rounded"
                >
                  Copy
                </button>
              </div>
              <textarea
                value={JSON.stringify(active, null, 2)}
                readOnly
                rows={12}
                className="w-full border rounded p-2 font-mono text-[11px] bg-zinc-50"
              />
              <div className="text-[11px] text-zinc-500">Agents: edit this JSON and paste below to import. Bindings: {`{{title}} {{price}} {{discount_pct}} {{vendor}}`}</div>
              <textarea
                placeholder="Paste AI-returned JSON here then press Import"
                rows={4}
                className="w-full border rounded p-2 font-mono text-xs"
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") importJson((e.target as HTMLTextAreaElement).value);
                }}
                id="import-json"
              />
              <button onClick={() => importJson((document.getElementById("import-json") as HTMLTextAreaElement)?.value ?? "")} className="w-full py-1.5 bg-zinc-900 text-white rounded text-xs">Import JSON</button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile layers/properties drawers */}
      <div className="lg:hidden border-t bg-white p-3 flex gap-2 overflow-auto text-xs">
        <span className="font-medium">Tip:</span> Open on desktop for full layers + properties. Mobile supports drag + AI prompts.
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

      {/* Size + feed preview bar */}
      <div className="bg-white border-t px-4 py-3 flex items-center gap-4">
        <div className="text-xs text-zinc-600">HTML templates double as ad creatives — no canvas lib. {isSaved ? "This revision is saved — use Enriched Feed above." : savedTemplate ? "This design has unsaved changes; save before using server output." : "Save to Server to enable enriched feed (image_link → /api/render)."}</div>
        <div className="ml-auto flex gap-2">
          <div className="hidden sm:flex items-center gap-2">
            {SIZE_PRESETS.map((s) => (
              <button key={s.id} onClick={() => changeSize(s.id)} className={`px-2 py-1 rounded text-xs border ${active.sizeId === s.id ? "bg-zinc-900 text-white" : "bg-white"}`}>{s.id}</button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 hidden sm:inline">Live templates: {templates.length}</span>
            {!projectId && (
              <button
                onClick={() => {
                  const t = createDefaultTemplate(active.sizeId);
                  setTemplates((p) => [...p, t]);
                  setActiveId(t.id);
                  markHumanDraftChange();
                  dispatchWorkspaceRevision({ type: "view-changed", actor: "human" });
                  setSaveError(null);
                }}
                className="px-3 py-1 border rounded text-xs"
              >
                New Template
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
