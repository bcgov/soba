import { render, screen } from '@testing-library/react';
import { AccordionGroup } from '@bcgov/design-system-react-components';
import { describe, expect, it, vi } from 'vitest';
import en from '@/dictionaries/en.json';
import FormApiKeyDrawer from '@/src/features/form-settings/credentials/FormApiKeyDrawer';
import WorkspaceApiKeyDrawer from '@/src/features/form-settings/credentials/WorkspaceApiKeyDrawer';

vi.mock('@/src/features/credentials/ui/ApiKeys', () => ({
  default: ({ scope }: { scope: { kind: string; id: string } }) => (
    <p data-testid="credential-target">
      {scope.kind}:{scope.id}
    </p>
  ),
}));

describe('API key settings drawers', () => {
  it('targets the form collection from form Settings', () => {
    render(
      <AccordionGroup defaultExpandedKeys={['form-api-keys']}>
        <FormApiKeyDrawer dict={en} drawerName="form-api-keys" formId="form" />
      </AccordionGroup>,
    );
    expect(screen.getByTestId('credential-target')).toHaveTextContent('form:form');
    expect(screen.getByText(en.apiKeys.formScope)).toBeInTheDocument();
  });
  it('targets the workspace collection from Workspace Form Settings', () => {
    render(
      <AccordionGroup defaultExpandedKeys={['workspace-api-keys']}>
        <WorkspaceApiKeyDrawer dict={en} drawerName="workspace-api-keys" workspaceId="workspace" />
      </AccordionGroup>,
    );
    expect(screen.getByTestId('credential-target')).toHaveTextContent('workspace:workspace');
    expect(screen.getByText(en.apiKeys.workspaceScope)).toBeInTheDocument();
  });
});
