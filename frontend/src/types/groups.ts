export type AudienceMode = 'public' | 'protected' | 'none';

export type SubmitterAudience = {
  mode: AudienceMode;
  idps: string[];
  users: { membershipId: string; displayLabel: string | null }[];
  available: { code: string; name: string }[];
};

export type SetSubmitterAudienceBody = { mode: 'public' } | { mode: 'protected'; idps: string[] };
