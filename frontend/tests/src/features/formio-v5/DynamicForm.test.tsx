import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

const h = vi.hoisted(() => ({ options: [] as unknown[] }));

vi.mock('next/dynamic', () => ({
  default: () =>
    function MockForm(props: { options?: unknown }) {
      h.options.push(props.options);
      return null;
    },
}));
vi.mock('@/lib/hooks/useFormioV5FormChrome', () => ({ useFormioV5FormChrome: vi.fn() }));
vi.mock('@/src/features/formio-v5/registerBcgovFormio', () => ({
  ensureBcgovFormioRegistered: vi.fn(),
}));

import { DynamicForm } from '@/src/features/formio-v5/ui/DynamicForm';
import { NO_INLINE_IMAGE_EDITORS } from '@/src/features/formio-v5/editorOptions';

describe('DynamicForm', () => {
  it('drops inline images when the caller passes no options', () => {
    h.options = [];
    render(<DynamicForm src="" />);
    expect(h.options.at(-1)).toEqual({ editors: NO_INLINE_IMAGE_EDITORS });
  });

  it("keeps the caller's options", () => {
    h.options = [];
    render(<DynamicForm src="" options={{ readOnly: true, noAlerts: true }} />);
    expect(h.options.at(-1)).toEqual({
      editors: NO_INLINE_IMAGE_EDITORS,
      readOnly: true,
      noAlerts: true,
    });
  });

  it('passes the same options object while the caller passes the same options', () => {
    h.options = [];
    const options = { readOnly: true };
    const { rerender } = render(<DynamicForm src="" options={options} />);
    rerender(<DynamicForm src="" options={options} />);
    expect(h.options).toHaveLength(2);
    expect(h.options[1]).toBe(h.options[0]);
  });
});
