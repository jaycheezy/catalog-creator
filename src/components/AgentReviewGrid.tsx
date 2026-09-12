import type { FeedRow } from "@/lib/facebook";
import { adaptTemplateToSize } from "@/editor/autoLayout";
import { TemplateRenderer } from "@/editor/TemplateRenderer";
import { SIZE_PRESETS } from "@/editor/types";
import { clonePreviewTemplate } from "@/workspace/previewCommands";
import type { WorkspaceReviewState } from "@/workspace/contracts";

function previewScale(sizeId: string): number {
  if (sizeId === "9:16") return 0.22;
  if (sizeId === "4:5") return 0.26;
  if (sizeId === "1.91:1") return 0.24;
  return 0.28;
}

export function AgentReviewGrid({ review, products, onClose }: {
  review: WorkspaceReviewState;
  products: readonly FeedRow[];
  onClose: () => void;
}) {
  return (
    <div className="flex-1 overflow-auto p-4 bg-zinc-100" data-agent-review={review.viewId}>
      <div className="mb-3 flex items-center gap-2 text-xs text-zinc-700">
        <span>
          Agent review · browser draft · revision {review.capturedDraftRevision} · {review.productIds.length * review.sizeIds.length} cells
        </span>
        <span className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-800">
          Preview only · not saved
        </span>
        <button onClick={onClose} className="ml-auto rounded border bg-white px-2 py-1 text-[11px]">
          Close review
        </button>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {review.productIds.flatMap((sourceId) => {
          const product = products.find((entry) => entry.source_id?.trim() === sourceId);
          if (!product) return [];
          return review.sizeIds.flatMap((sizeId) => {
            const preset = SIZE_PRESETS.find(({ id }) => id === sizeId);
            if (!preset) return [];
            const template = adaptTemplateToSize(clonePreviewTemplate(review.template), preset);
            const scale = previewScale(sizeId);
            return [
              <article key={`${sourceId}:${sizeId}`} className="rounded-lg border bg-white p-3">
                <div className="mb-2 min-w-0 text-xs">
                  <div className="truncate font-medium" title={product.title}>{product.title}</div>
                  <div className="mt-0.5 break-all text-[11px] text-zinc-500">{sourceId}</div>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-zinc-600">
                    <span>{sizeId} · {preset.width}×{preset.height}</span>
                    {product.sale_price && <span className="rounded bg-rose-100 px-1.5 py-0.5 text-rose-700">Sale · {product.sale_price}</span>}
                  </div>
                </div>
                <div className="mx-auto overflow-hidden border bg-zinc-50" style={{ width: template.width * scale, height: template.height * scale }}>
                  <TemplateRenderer template={template} product={product} scale={scale} />
                </div>
              </article>,
            ];
          });
        })}
      </div>
    </div>
  );
}
