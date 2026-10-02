import { createFormsApiService } from '../../../../src/core/api/forms/serviceFactory';
import { formSubmitterAudienceService } from '../../../../src/core/api/forms/submitterAudience';
import type { FormService } from '../../../../src/core/services/formService';
import type { FormVersionService } from '../../../../src/core/services/formVersionService';
import { db } from '../../../../src/core/db/client';

jest.mock('../../../../src/core/db/client', () => ({
  db: { transaction: jest.fn((cb) => cb('mock-tx')) },
}));

jest.mock('../../../../src/core/api/forms/submitterAudience', () => ({
  formSubmitterAudienceService: {
    set: jest.fn(),
  },
}));

describe('FormsApiService.createForm', () => {
  let formService: jest.Mocked<FormService>;
  let formVersionService: jest.Mocked<FormVersionService>;
  let apiService: ReturnType<typeof createFormsApiService>;

  beforeEach(() => {
    jest.clearAllMocks();
    formService = {
      create: jest.fn().mockResolvedValue({
        form: { id: 'f1', name: 'My Form', createdAt: new Date(), updatedAt: new Date() },
        version: { id: 'v1', formId: 'f1', createdAt: new Date(), updatedAt: new Date() },
      }),
    } as unknown as jest.Mocked<FormService>;
    formVersionService = {} as unknown as jest.Mocked<FormVersionService>;

    apiService = createFormsApiService(formService, formVersionService);
  });

  it('creates form and sets submitter audience in a transaction', async () => {
    const ctx = { workspaceId: 'ws1', actorId: 'a1', actorDisplayLabel: 'A' };
    const input = {
      name: 'My Form',
      submitterAudience: { mode: 'public' as const },
    };

    await apiService.createForm(
      ctx as unknown as Parameters<typeof apiService.createForm>[0],
      input,
    );

    expect(db.transaction).toHaveBeenCalled();
    expect(formService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws1',
        name: 'My Form',
        executor: 'mock-tx',
      }),
    );
    expect(formSubmitterAudienceService.set).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: 'ws1', locale: 'en' }),
      'f1',
      input.submitterAudience,
      'mock-tx',
    );
  });

  it('creates form without setting submitter audience if not provided', async () => {
    const ctx = { workspaceId: 'ws1', actorId: 'a1', actorDisplayLabel: 'A' };
    const input = {
      name: 'My Form',
    };

    await apiService.createForm(
      ctx as unknown as Parameters<typeof apiService.createForm>[0],
      input,
    );

    expect(db.transaction).toHaveBeenCalled();
    expect(formService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws1',
        name: 'My Form',
        executor: 'mock-tx',
      }),
    );
    expect(formSubmitterAudienceService.set).not.toHaveBeenCalled();
  });
});
