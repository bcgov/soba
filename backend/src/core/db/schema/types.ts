/**
 * Canonical status/state union types for schema and application code.
 * Use these in repo interfaces and API schemas; DB uses CHECK constraints to enforce.
 */
export type FormStatus = 'active' | 'archived' | 'deleted';
export type FormVersionState = 'draft' | 'published' | 'archived' | 'deleted';
export type FormVersionEngineSyncStatus = 'pending' | 'provisioning' | 'ready' | 'error';
export type WorkspaceMembershipStatus = 'active' | 'inactive' | 'pending';
export type WorkspaceMembershipRole = 'owner' | 'admin' | 'member' | 'viewer';
