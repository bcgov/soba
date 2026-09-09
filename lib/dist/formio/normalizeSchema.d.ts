/**
 * Normalize a Form.io schema — for both import (file upload) and export (download) — into a
 * clean, portable, builder-ready form definition:
 *  1. apply the legacy CHEFS-1 type fix (no-op for current schemas),
 *  2. keep only form-definition fields, dropping engine/document metadata (`name`, `path`,
 *     `tags`, `access`, `submissionAccess`, `properties`, `_id`, `machineName`, `pdfComponents`, …),
 *  3. repair malformed component widgets.
 * Idempotent.
 */
export declare function normalizeSchema(schema: Record<string, unknown>): Record<string, unknown>;
