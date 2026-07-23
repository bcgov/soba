import { isFeatureAvailable } from '../../../src/core/services/featureAvailabilityService';
import * as featureRepo from '../../../src/core/db/repos/featureRepo';
import * as featureScopeRepo from '../../../src/core/db/repos/featureScopeRepo';

jest.mock('../../../src/core/db/client', () => ({ db: {} }));

jest.mock('../../../src/core/db/repos/featureRepo', () => ({
  getFeatureGateCached: jest.fn(),
}));

jest.mock('../../../src/core/db/repos/featureScopeRepo', () => ({
  hasActiveFeatureGrant: jest.fn(),
}));

const getFeatureGateCached = featureRepo.getFeatureGateCached as unknown as jest.Mock;
const hasActiveFeatureGrant = featureScopeRepo.hasActiveFeatureGrant as unknown as jest.Mock;

describe('featureAvailabilityService.isFeatureAvailable', () => {
  beforeEach(() => {
    getFeatureGateCached.mockReset();
    hasActiveFeatureGrant.mockReset();
  });

  it('is unavailable when the feature is not present', async () => {
    getFeatureGateCached.mockResolvedValue(null);

    await expect(isFeatureAvailable('missing')).resolves.toBe(false);
    expect(hasActiveFeatureGrant).not.toHaveBeenCalled();
  });

  it('is unavailable when the feature is platform-disabled, regardless of scope', async () => {
    getFeatureGateCached.mockResolvedValue({ enabled: false, availability: 'fixed' });

    await expect(isFeatureAvailable('x', { workspaceId: 'w' })).resolves.toBe(false);
    expect(hasActiveFeatureGrant).not.toHaveBeenCalled();
  });

  it('is available everywhere for an enabled fixed feature, without a grant lookup', async () => {
    getFeatureGateCached.mockResolvedValue({ enabled: true, availability: 'fixed' });

    await expect(isFeatureAvailable('x', { workspaceId: 'w' })).resolves.toBe(true);
    expect(hasActiveFeatureGrant).not.toHaveBeenCalled();
  });

  it('defers to the grant lookup for an enabled scoped feature', async () => {
    getFeatureGateCached.mockResolvedValue({ enabled: true, availability: 'scoped' });
    hasActiveFeatureGrant.mockResolvedValue(true);

    await expect(isFeatureAvailable('x', { formId: 'f' })).resolves.toBe(true);
    expect(hasActiveFeatureGrant).toHaveBeenCalledWith({
      featureCode: 'x',
      workspaceId: undefined,
      formId: 'f',
    });
  });

  it('is unavailable for a scoped feature with no matching grant', async () => {
    getFeatureGateCached.mockResolvedValue({ enabled: true, availability: 'scoped' });
    hasActiveFeatureGrant.mockResolvedValue(false);

    await expect(isFeatureAvailable('x', { workspaceId: 'w' })).resolves.toBe(false);
  });
});
