jest.mock('../../../../src/core/services/featureAvailabilityService', () => ({
  isFeatureAvailable: jest.fn(),
}));

import { metaApiService } from '../../../../src/core/api/meta/service';
import * as availability from '../../../../src/core/services/featureAvailabilityService';

const isFeatureAvailable = availability.isFeatureAvailable as unknown as jest.Mock;

describe('MetaApiService.getFeatureAvailability', () => {
  beforeEach(() => {
    isFeatureAvailable.mockReset();
  });

  it('resolves the scope and echoes the code with the result', async () => {
    isFeatureAvailable.mockResolvedValue(true);

    const result = await metaApiService.getFeatureAvailability({
      code: 'document-generation-v3',
      workspaceId: 'w1',
    });

    expect(result).toEqual({ code: 'document-generation-v3', available: true });
    expect(isFeatureAvailable).toHaveBeenCalledWith('document-generation-v3', {
      workspaceId: 'w1',
      formId: undefined,
    });
  });
});
