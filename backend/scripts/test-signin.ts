/**
 * Test sign-in flow: call the backend with a real IdP token, then verify that
 * the expected records exist in the database (identity_provider, app_user,
 * user_identity, personal workspace with user in owners group, and soba_admin if applicable).
 *
 * Usage:
 *   # GitHub (token from gh auth token or a PAT)
 *   SOBA_TEST_TOKEN=$(gh auth token) npm run script:test-signin
 *   # or
 *   SOBA_TEST_TOKEN=ghp_xxx npm run script:test-signin -- --idp=github
 *
 *   # BC Gov SSO (JWT from your dev realm)
 *   SOBA_TEST_TOKEN=eyJ... npm run script:test-signin -- --idp=bcgov-sso
 *
 *   # Base URL (default http://localhost:4000)
 *   SOBA_API_BASE_URL=http://localhost:4000 npm run script:test-signin
 *
 * Requires: backend running, DATABASE_URL set, and a valid token for one of
 * the enabled IdPs (bcgov-sso, idp-github).
 */
import { and, eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { db } from '../src/core/db/client';
import { Roles } from '../src/core/db/codes';
import {
  appUsers,
  identityProviders,
  sobaAdmins,
  userIdentities,
  workspaceGroupMemberships,
  workspaceGroups,
  workspaceMemberships,
  workspaces,
} from '../src/core/db/schema';

const API_BASE = process.env.SOBA_API_BASE_URL || 'http://localhost:4000';

function normalizeToken(rawToken: string | undefined): string | undefined {
  if (!rawToken) return undefined;
  const trimmed = rawToken.trim().replace(/^['"]|['"]$/g, '');
  return trimmed.replace(/^Bearer\s+/i, '');
}

const TOKEN = normalizeToken(
  process.env.SOBA_TEST_TOKEN || process.argv.find((a) => a.startsWith('--token='))?.slice(8),
);

type IdpKind = 'github' | 'bcgov-sso';

function parseIdp(): IdpKind {
  const arg = process.argv.find((a) => a.startsWith('--idp='));
  const val = arg?.slice(6)?.toLowerCase();
  if (val === 'bcgov-sso' || val === 'bcgov') return 'bcgov-sso';
  return 'github';
}

async function getExpectedFromGitHub(
  token: string,
): Promise<{ subject: string; providerCode: string; displayLabel?: string }> {
  const res = await fetch('https://api.github.com/user', {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API error ${res.status}: ${text || res.statusText}`);
  }
  const user = (await res.json()) as { id?: number; login?: string; name?: string | null };
  const subject = user.id != null ? String(user.id) : (user.login && String(user.login)) || '';
  const displayLabel = user.login || (user.name && String(user.name)) || subject;
  return { subject, providerCode: 'github', displayLabel };
}

function getExpectedFromBcgovJwt(token: string): {
  subject: string;
  providerCode: string;
  displayLabel?: string;
} {
  // JWTs must be dot-separated (header.payload.signature).
  if (token.split('.').length !== 3) {
    throw new Error(
      'Expected a JWT for --idp=bcgov-sso (format: header.payload.signature). If using a GitHub token/PAT, run with --idp=github instead.',
    );
  }
  const decoded = jwt.decode(token);
  if (!decoded || typeof decoded !== 'object') {
    throw new Error(
      'Invalid JWT: could not decode payload. Ensure SOBA_TEST_TOKEN is a raw JWT string (no quotes, no extra text).',
    );
  }
  const payload = decoded as Record<string, unknown>;
  const sub = payload.sub;
  const subject = typeof sub === 'string' ? sub : typeof sub === 'number' ? String(sub) : '';
  const idp =
    typeof payload.identity_provider === 'string'
      ? payload.identity_provider
      : typeof (payload as Record<string, unknown>).idpType === 'string'
        ? ((payload as Record<string, unknown>).idpType as string)
        : 'idir';
  const providerCode = idp.toLowerCase();
  const displayLabel =
    (typeof (payload as Record<string, unknown>).idir_username === 'string' &&
      (payload as Record<string, unknown>).idir_username) ||
    (typeof (payload as Record<string, unknown>).bceid_username === 'string' &&
      (payload as Record<string, unknown>).bceid_username) ||
    (typeof (payload as Record<string, unknown>).email === 'string' &&
      (payload as Record<string, unknown>).email) ||
    (typeof (payload as Record<string, unknown>).preferred_username === 'string' &&
      (payload as Record<string, unknown>).preferred_username) ||
    subject;
  return { subject, providerCode, displayLabel: displayLabel as string };
}

async function callSignIn(
  token: string,
): Promise<{ ok: boolean; status: number; body: unknown; text: string }> {
  const res = await fetch(`${API_BASE}/api/v1/forms`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  const text = await res.text();
  const body = (() => {
    try {
      return text ? (JSON.parse(text) as unknown) : {};
    } catch {
      return { raw: text };
    }
  })();
  return { ok: res.ok, status: res.status, body, text };
}

async function callAuthedJson(
  token: string,
  path: string,
): Promise<{ ok: boolean; status: number; body: unknown; text: string }> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  const text = await res.text();
  const body = (() => {
    try {
      return text ? (JSON.parse(text) as unknown) : {};
    } catch {
      return { raw: text };
    }
  })();
  return { ok: res.ok, status: res.status, body, text };
}

async function verifyDbRecords(
  providerCode: string,
  subject: string,
  expectedDisplayLabel?: string,
) {
  const normalizedProvider = providerCode.toLowerCase();

  const providerRow = await db
    .select()
    .from(identityProviders)
    .where(eq(identityProviders.code, normalizedProvider))
    .limit(1);
  const provider = providerRow[0];
  if (!provider) {
    return { ok: false, message: `Missing identity_provider with code=${normalizedProvider}` };
  }

  const identityRow = await db
    .select()
    .from(userIdentities)
    .where(
      and(
        eq(userIdentities.identityProviderCode, provider.code),
        eq(userIdentities.subject, subject),
      ),
    )
    .limit(1);
  const identity = identityRow[0];
  if (!identity) {
    return {
      ok: false,
      message: `Missing user_identity for provider=${normalizedProvider}, subject=${subject}`,
    };
  }

  const userRow = await db.select().from(appUsers).where(eq(appUsers.id, identity.userId)).limit(1);
  const user = userRow[0];
  if (!user) {
    return { ok: false, message: `Missing app_user for user_id=${identity.userId}` };
  }

  if (expectedDisplayLabel != null && user.displayLabel !== expectedDisplayLabel) {
    return {
      ok: false,
      message: `app_user.display_label mismatch: expected "${expectedDisplayLabel}", got "${user.displayLabel}"`,
    };
  }

  // Require personal workspace with user in owners group (ensureHomeWorkspace creates these on first sign-in)
  const personalWithOwnerGroup = await db
    .select({
      workspaceId: workspaces.id,
      workspaceName: workspaces.name,
      kind: workspaces.kind,
      membershipId: workspaceMemberships.id,
      membershipRole: workspaceMemberships.role,
      membershipSource: workspaceMemberships.source,
      ownersGroupId: workspaceGroups.id,
      ownersGroupName: workspaceGroups.name,
    })
    .from(workspaceMemberships)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMemberships.workspaceId))
    .innerJoin(
      workspaceGroupMemberships,
      and(
        eq(workspaceGroupMemberships.workspaceMembershipId, workspaceMemberships.id),
        eq(workspaceGroupMemberships.workspaceId, workspaces.id),
      ),
    )
    .innerJoin(
      workspaceGroups,
      and(
        eq(workspaceGroups.id, workspaceGroupMemberships.groupId),
        eq(workspaceGroups.workspaceId, workspaces.id),
        eq(workspaceGroups.roleCode, Roles.workspace_owner),
      ),
    )
    .where(
      and(
        eq(workspaceMemberships.userId, user.id),
        eq(workspaceMemberships.status, 'active'),
        eq(workspaces.kind, 'personal'),
        eq(workspaceGroupMemberships.status, 'active'),
      ),
    )
    .limit(5);

  if (personalWithOwnerGroup.length === 0) {
    return {
      ok: false,
      message:
        'Missing personal workspace with user in owners group (ensureHomeWorkspace should create these on first sign-in)',
    };
  }

  // SOBA admin: optional; report if user is in soba_admin table
  const adminRow = await db
    .select({
      userId: sobaAdmins.userId,
      source: sobaAdmins.source,
      identityProviderCode: sobaAdmins.identityProviderCode,
    })
    .from(sobaAdmins)
    .where(eq(sobaAdmins.userId, user.id))
    .limit(1);
  const sobaAdmin = adminRow[0] ?? null;

  return {
    ok: true,
    provider,
    identity,
    user,
    personalWorkspace: personalWithOwnerGroup[0],
    sobaAdmin,
  };
}

type WorkspaceItem = {
  id: string;
  name: string;
  slug: string | null;
  kind: string;
  role: string;
  status: string;
};

type WorkspaceListResponse = {
  items: WorkspaceItem[];
  page: {
    limit: number;
    hasMore: boolean;
    nextCursor: string | null;
    cursorMode: string;
  };
  filters: {
    kind?: string;
    status?: string;
  };
  sort: string;
};

type MemberItem = {
  id: string;
  userId: string;
  displayLabel: string | null;
  role: string;
  status: string;
};

type MembersListResponse = {
  items: MemberItem[];
  page: {
    limit: number;
    hasMore: boolean;
    nextCursor: string | null;
    cursorMode: string;
  };
  filters: {
    role?: string;
    status?: string;
  };
  sort: string;
};

type SobaAdminItem = {
  userId: string;
  source: string;
  identityProviderCode: string | null;
  syncedAt: string | null;
  displayLabel: string | null;
};

type SobaAdminsListResponse = {
  items: SobaAdminItem[];
  page: {
    limit: number;
    hasMore: boolean;
    nextCursor: string | null;
    cursorMode: string;
  };
};

async function main() {
  if (!TOKEN) {
    console.error('Missing token. Set SOBA_TEST_TOKEN or pass --token=YOUR_TOKEN');
    process.exit(1);
  }

  const idp = parseIdp();
  console.log(`IdP: ${idp}`);
  console.log(`API base: ${API_BASE}`);
  console.log('');

  let expected: { subject: string; providerCode: string; displayLabel?: string };
  try {
    if (idp === 'github') {
      expected = await getExpectedFromGitHub(TOKEN);
    } else {
      expected = getExpectedFromBcgovJwt(TOKEN);
    }
  } catch (e) {
    console.error('Failed to get expected identity from token:', (e as Error).message);
    process.exit(1);
  }

  console.log('Expected after sign-in:', expected);
  console.log('');

  const signInResult = await callSignIn(TOKEN);
  if (!signInResult.ok) {
    const errBody =
      signInResult.body && typeof signInResult.body === 'object' && 'error' in signInResult.body
        ? (signInResult.body as { error: string }).error
        : signInResult.text || JSON.stringify(signInResult.body);
    console.error('Sign-in request failed:', signInResult.status, errBody);
    if (signInResult.status === 500) {
      console.error(
        'Tip: ensure migrations are applied (npm run db:migrate) and seed run (npm run db:seed); soba_admin and role tables must exist.',
      );
    }
    process.exit(1);
  }
  console.log('Sign-in request succeeded (HTTP', signInResult.status, ')');
  console.log('');

  const verify = await verifyDbRecords(
    expected.providerCode,
    expected.subject,
    expected.displayLabel,
  );
  if (!verify.ok) {
    console.error('DB verification failed:', verify.message);
    process.exit(1);
  }

  console.log('DB verification passed:');
  console.log('  identity_provider: code=', verify.provider!.code);
  console.log(
    '  user_identity:    subject=',
    verify.identity!.subject,
    ', user_id=',
    verify.identity!.userId,
  );
  console.log(
    '  app_user:         id=',
    verify.user!.id,
    ', display_label=',
    verify.user!.displayLabel,
  );
  const pw = verify.personalWorkspace!;
  console.log('  personal workspace:', pw.workspaceName, `(${pw.kind})`, pw.workspaceId);
  console.log(
    '    membership:     role=',
    pw.membershipRole,
    ', source=',
    pw.membershipSource,
    ', id=',
    pw.membershipId,
  );
  console.log(
    '    owners group:   ',
    pw.ownersGroupName,
    '(role_code=workspace_owner)',
    pw.ownersGroupId,
  );
  if (verify.sobaAdmin) {
    const idpPart = verify.sobaAdmin.identityProviderCode
      ? `, idp=${verify.sobaAdmin.identityProviderCode}`
      : '';
    console.log('  soba_admin:        yes (source=', verify.sobaAdmin.source, idpPart, ')');
  } else {
    console.log('  soba_admin:        no');
  }
  console.log('');

  // Workspace-related API checks
  const workspacesResult = await callAuthedJson(TOKEN, '/api/v1/workspaces?limit=50');
  if (!workspacesResult.ok) {
    const err =
      workspacesResult.body &&
      typeof workspacesResult.body === 'object' &&
      'error' in workspacesResult.body
        ? (workspacesResult.body as { error: string }).error
        : workspacesResult.text || JSON.stringify(workspacesResult.body);
    console.error('Workspaces API failed:', workspacesResult.status, err);
    process.exit(1);
  }
  const workspacesBody = workspacesResult.body as WorkspaceListResponse;
  const listedPersonal = Array.isArray(workspacesBody.items)
    ? workspacesBody.items.find((w) => w.id === verify.personalWorkspace!.workspaceId)
    : undefined;
  if (!listedPersonal) {
    console.error(
      'Workspaces API verification failed: personal workspace not present in /api/v1/workspaces result',
    );
    process.exit(1);
  }
  console.log(
    'Workspaces API passed: listed personal workspace',
    listedPersonal.name,
    `(${listedPersonal.kind})`,
    listedPersonal.id,
  );

  const currentWorkspaceResult = await callAuthedJson(TOKEN, '/api/v1/workspaces/current');
  if (!currentWorkspaceResult.ok) {
    const err =
      currentWorkspaceResult.body &&
      typeof currentWorkspaceResult.body === 'object' &&
      'error' in currentWorkspaceResult.body
        ? (currentWorkspaceResult.body as { error: string }).error
        : currentWorkspaceResult.text || JSON.stringify(currentWorkspaceResult.body);
    console.error('Current workspace API failed:', currentWorkspaceResult.status, err);
    process.exit(1);
  }
  const currentWorkspace = currentWorkspaceResult.body as WorkspaceItem;
  console.log(
    'Current workspace API passed:',
    currentWorkspace.name,
    `(${currentWorkspace.kind})`,
    currentWorkspace.id,
  );

  const membersResult = await callAuthedJson(TOKEN, '/api/v1/members?limit=100&status=active');
  if (!membersResult.ok) {
    const err =
      membersResult.body && typeof membersResult.body === 'object' && 'error' in membersResult.body
        ? (membersResult.body as { error: string }).error
        : membersResult.text || JSON.stringify(membersResult.body);
    console.error('Members API failed:', membersResult.status, err);
    process.exit(1);
  }
  const membersBody = membersResult.body as MembersListResponse;
  const hasSelfMember = Array.isArray(membersBody.items)
    ? membersBody.items.some((m) => m.userId === verify.user!.id)
    : false;
  if (!hasSelfMember) {
    console.error(
      'Members API verification failed: signed-in user not found in current workspace members list',
    );
    process.exit(1);
  }
  console.log(
    'Members API passed: user found in current workspace members list (active members:',
    Array.isArray(membersBody.items) ? membersBody.items.length : 0,
    ')',
  );

  // Admin API checks only if this user is already a SOBA admin.
  if (verify.sobaAdmin) {
    const adminsResult = await callAuthedJson(TOKEN, '/api/v1/admin/soba-admins?limit=100');
    if (!adminsResult.ok) {
      const err =
        adminsResult.body && typeof adminsResult.body === 'object' && 'error' in adminsResult.body
          ? (adminsResult.body as { error: string }).error
          : adminsResult.text || JSON.stringify(adminsResult.body);
      console.error('Admin API failed:', adminsResult.status, err);
      process.exit(1);
    }
    const adminsBody = adminsResult.body as SobaAdminsListResponse;
    const hasSelfAdmin = Array.isArray(adminsBody.items)
      ? adminsBody.items.some((a) => a.userId === verify.user!.id)
      : false;
    if (!hasSelfAdmin) {
      console.error(
        'Admin API verification failed: user is in DB soba_admin table but missing from /api/v1/admin/soba-admins',
      );
      process.exit(1);
    }
    console.log('Admin API passed: user present in /api/v1/admin/soba-admins');
  } else {
    console.log('Admin API skipped: user is not a SOBA admin');
  }
  console.log('');

  console.log(
    'Done. Expected records are present and related APIs are verified (workspaces, current workspace, members, admin list when applicable).',
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
