'use client';

import { Component, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  fallback: ReactNode;
};

type State = { error: Error | null };

/**
 * Catches synchronous render errors in the Form.io subtree. Async / `onError` paths use
 * {@link normalizeFormioRenderError} in the parent. Reset by remounting (`key` on parent).
 */
export class FormioV5FormRenderErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error): void {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[FormioV5FormRenderErrorBoundary]', error);
    }
  }

  render(): ReactNode {
    if (this.state.error) return this.props.fallback;
    return this.props.children;
  }
}
