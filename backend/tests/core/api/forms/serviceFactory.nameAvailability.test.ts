import { createFormsApiService } from '../../../../src/core/api/forms/serviceFactory';
import type { FormService } from '../../../../src/core/services/formService';
import type { FormVersionService } from '../../../../src/core/services/formVersionService';
import type { CoreRequestContext } from '../../../../src/core/middleware/requestContext';

const ctx = (formId?: string): CoreRequestContext => ({
  workspaceId: 'ws1',
  ...(formId ? { formId } : {}),
  actorId: 'actor1',
  actorDisplayLabel: 'Actor One',
  workspaceSource: 'test',
  role: 'member',
});

const setup = (available: boolean) => {
  const isNameAvailable = jest.fn().mockResolvedValue(available);
  const api = createFormsApiService(
    { isNameAvailable } as unknown as FormService,
    {} as unknown as FormVersionService,
  );
  return { api, isNameAvailable };
};

describe('checkNameAvailable', () => {
  it.each([true, false])("answers a new form's name in its workspace: %s", async (available) => {
    const { api, isNameAvailable } = setup(available);

    await expect(api.checkNameAvailable(ctx(), 'Permit')).resolves.toEqual({ available });
    expect(isNameAvailable).toHaveBeenCalledWith('ws1', 'Permit', undefined);
  });

  it('leaves out the form being renamed', async () => {
    const { api, isNameAvailable } = setup(true);

    await api.checkNameAvailable(ctx('f1'), 'Permit');
    expect(isNameAvailable).toHaveBeenCalledWith('ws1', 'Permit', 'f1');
  });
});
