#!/usr/bin/env npx tsx
/**
 * Form.io CE v5 client script using the formio-v5 plugin client and config.
 * Uses PLUGIN_FORMIO_V5_* env (see .env.example). Runs health check, login,
 * load roles, create form, create submissions, load form and submissions.
 *
 * Usage: npx tsx scripts/run-v5-client.ts
 */

import { env } from '../src/core/config/env';
env.loadEnv();

import { createPluginConfigReader } from '../src/core/config/pluginConfig';
import { FormioCommunityEditionAPIv5Client } from '../src/plugins/formio-v5/formioV5Client';

const PLUGIN_CODE = 'formio-v5';

async function main() {
  const config = createPluginConfigReader(PLUGIN_CODE);
  const baseUrl = config.getRequired('ADMIN_API_URL');
  const username = config.getRequired('ADMIN_USERNAME');
  const password = config.getRequired('ADMIN_PASSWORD');

  console.log('Formio CE v5 client (formio-v5 plugin config)');
  console.log('Base URL:', baseUrl);
  console.log('');

  // --- Health (no auth) ---
  console.log('--- Health ---');
  const anonClient = new FormioCommunityEditionAPIv5Client({
    baseUrl,
    username: '',
    password: '',
  });
  const health = await anonClient.healthCheck();
  console.log('healthCheck():', health.ok ? 'OK' : `unhealthy (${health.message ?? 'unknown'})`);
  console.log('');

  // --- Login (admin from config) ---
  console.log('--- Login ---');
  const client = new FormioCommunityEditionAPIv5Client({
    baseUrl,
    username,
    password,
  });
  await client.login();
  if (!client.getToken()) {
    console.error('Login failed');
    process.exit(1);
  }
  console.log('Logged in as', username);
  console.log('');

  // --- Roles ---
  console.log('--- Roles ---');
  let authenticatedRoleId: string | null = null;
  try {
    const roles = await client.loadRoles();
    const authenticated = roles.find(
      (r) =>
        (r.name && r.name.toLowerCase() === 'authenticated') ||
        (r.title && r.title.toLowerCase() === 'authenticated'),
    );
    if (authenticated) authenticatedRoleId = authenticated._id;
    console.log('Roles:', roles.length, 'total');
  } catch (err) {
    console.log('loadRoles failed:', err instanceof Error ? err.message : String(err));
  }
  console.log('');

  const submissionAccess =
    authenticatedRoleId != null
      ? [
          { type: 'create_own' as const, roles: [authenticatedRoleId] },
          { type: 'read_own' as const, roles: [authenticatedRoleId] },
          { type: 'update_own' as const, roles: [authenticatedRoleId] },
          { type: 'delete_own' as const, roles: [authenticatedRoleId] },
        ]
      : undefined;

  const slug = `v5-demo-${Date.now()}`;

  // --- Forms + submissions ---
  console.log('--- Forms + submissions ---');
  console.log('Create form → create 3 submissions → load form → load submissions.');
  console.log('');

  const form = await client.saveForm({
    title: 'Demo form',
    name: slug,
    path: slug,
    type: 'form',
    components: [{ type: 'textfield', key: 'field1', label: 'Field 1' }],
    ...(submissionAccess && { submissionAccess }),
  });
  const formId = form._id;

  const s1 = await client.saveSubmission(formId, {
    data: { field1: 'First submission' },
  } as { data: Record<string, string> });
  const s2 = await client.saveSubmission(formId, {
    data: { field1: 'Second submission' },
  } as { data: Record<string, string> });
  const s3 = await client.saveSubmission(formId, {
    data: { field1: 'Third submission' },
  } as { data: Record<string, string> });

  const loadedForm = await client.loadForm(formId);
  const allSubs = await client.loadSubmissions(formId, { params: { limit: 10 } });

  console.log('Form:', (loadedForm as { title?: string })?.title ?? formId);
  console.log(
    'Submissions created (ids):',
    [s1._id, s2._id, s3._id].filter(Boolean).join(', ') || '—',
  );
  console.log(
    'Submissions read (ids):',
    allSubs
      .map((s: { _id?: string }) => s._id)
      .filter(Boolean)
      .join(', ') || '—',
  );
  console.log('');

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
