import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { Form, type FormType } from '@formio/react';
import { discardStoredFiles, fillFormOptions } from '@/src/features/formio-v5/fillFileOptions';

// The real Form.io and BC Gov file component, with a file kept in the browser the way the component
// keeps one it could not upload: what the fill form's options make of it is what these tests are for.

const SCHEMA = {
  display: 'form',
  components: [
    { type: 'bcgov-file', key: 'doc', label: 'Doc', input: true, multiple: true, storage: 'chefs' },
  ],
} as unknown as FormType;

// How the component writes a file to localStorage, the store it uses where IndexedDB is missing.
const FILE_KEY = 'bcgov-formio-offline-file:k-1';
const META_KEY = 'bcgov-formio-offline-file-meta:k-1';

const storeFile = (scope: string) => {
  localStorage.setItem(FILE_KEY, 'data:text/plain;base64,YQ==');
  localStorage.setItem(
    META_KEY,
    JSON.stringify({
      offlineKey: 'k-1',
      scope,
      componentPath: 'doc',
      userId: 'u-1',
      name: 'kept.txt',
      originalName: 'kept.txt',
      size: 1,
      type: 'text/plain',
      createdAt: 1,
    }),
  );
};

type Webform = {
  data: { doc?: { offlineKey?: string }[] };
  everyComponent: (visit: (component: unknown) => void) => void;
};

const settle = (ms = 800) => act(() => new Promise((resolve) => setTimeout(resolve, ms)));

const renderFill = async (submissionId: string) => {
  let webform: Webform | undefined;
  const options = fillFormOptions({
    canWrite: true,
    fileOption: { bcgovFile: { getUserId: 'u-1' } },
    submissionId,
  });
  const view = render(
    <Form
      src=""
      form={SCHEMA}
      options={options}
      onFormReady={(instance) => {
        webform = instance as unknown as Webform;
      }}
    />,
  );
  await settle();
  if (!webform) throw new Error('The webform did not load');
  return { webform, view };
};

const restored = (webform: Webform) => (webform.data.doc ?? []).map((file) => file.offlineKey);

describe('the fill form options on the real Form.io', () => {
  beforeAll(async () => {
    const { Formio } = await import('@formio/js');
    const bcgov = (await import('formio-components@0.0.3')) as { default?: unknown };
    (Formio as unknown as { use: (plugin: unknown) => void }).use(bcgov.default ?? bcgov);
  });

  // Offline, so a restored file stays kept rather than being sent to an upload provider.
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("restores a kept file into its own submission's form", async () => {
    storeFile('sub-1');
    const { webform, view } = await renderFill('sub-1');

    expect(restored(webform)).toEqual(['k-1']);
    view.unmount();
  });

  it("does not restore a kept file into another submission's form", async () => {
    storeFile('sub-1');
    const { webform, view } = await renderFill('sub-2');

    expect(restored(webform)).toEqual([]);
    view.unmount();
  });

  it('deletes the kept files, so the next form for the submission has none', async () => {
    storeFile('sub-1');
    const first = await renderFill('sub-1');
    expect(restored(first.webform)).toEqual(['k-1']);

    await act(() => discardStoredFiles(first.webform));
    first.view.unmount();

    expect(localStorage.getItem(META_KEY)).toBeNull();
    expect(localStorage.getItem(FILE_KEY)).toBeNull();
    const next = await renderFill('sub-1');
    expect(restored(next.webform)).toEqual([]);
    next.view.unmount();
  });
});
