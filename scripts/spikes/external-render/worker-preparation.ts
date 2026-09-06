// Pure preparation probe; no next/og, fonts, Satori or Resvg runtime imports.
// This does not measure deployed Worker CPU or R2/network operations.
import { productRevision } from "@/lib/renderCache";
import { selectRenderProduct } from "@/lib/renderProduct";
import type { CatalogPublicationSnapshot } from "@/lib/catalogPublication";
export async function prepare(rawSnapshot: string, productId: string) {
  const snapshot = JSON.parse(rawSnapshot) as CatalogPublicationSnapshot;
  const product = selectRenderProduct(snapshot.products, { productId, handle: null });
  const revision = await productRevision(product);
  const payload = JSON.stringify({ schemaVersion: 1, rendererVersion: 1, requestId: "synthetic-probe",
    template: snapshot.template, product, width: snapshot.template.width, height: snapshot.template.height });
  return { revision, payloadBytes: new TextEncoder().encode(payload).length };
}
