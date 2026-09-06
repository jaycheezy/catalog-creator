import type { Template } from "./types";

export type SavedTemplateRecord = {
  templateId: string;
  fingerprint: string;
  revision: number;
};

/** Server-managed fields do not make an otherwise identical draft dirty. */
export function templateFingerprint(template: Template): string {
  const { revision: _revision, updatedAt: _updatedAt, ...design } = template;
  void _revision;
  void _updatedAt;
  return JSON.stringify(design);
}

export function isTemplateSaved(template: Template, record: SavedTemplateRecord | undefined): boolean {
  return Boolean(record && record.templateId === template.id && record.fingerprint === templateFingerprint(template));
}
