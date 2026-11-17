jest.mock('../../../src/core/services/featureAvailabilityService', () => ({
  isFeatureAvailable: jest.fn(),
}));

import { CONFIRMATION_SCREEN_FEATURE, CONFIRMATION_SETTING_FEATURES } from '@soba/lib';
import { Features } from '../../../src/core/db/codes';
import { isFeatureAvailable } from '../../../src/core/services/featureAvailabilityService';
import { confirmationSettingAvailability } from '../../../src/features/form-settings/confirmation/availability';

const mockFeature = jest.mocked(isFeatureAvailable);
const scope = { workspaceId: 'ws1', formId: 'f1' };
const featureOff = (code: string) =>
  mockFeature.mockImplementation((feature) => Promise.resolve(feature !== code));

beforeEach(() => {
  jest.resetAllMocks();
  mockFeature.mockResolvedValue(true);
});

it('names only backend feature codes', () => {
  const codes = new Set<string>(Object.values(Features));
  for (const feature of [
    CONFIRMATION_SCREEN_FEATURE,
    ...Object.values(CONFIRMATION_SETTING_FEATURES),
  ]) {
    expect(codes.has(feature)).toBe(true);
  }
});

it('makes every setting available while every feature is on', async () => {
  await expect(confirmationSettingAvailability(scope)).resolves.toEqual({
    allowSubmitterEmailCopy: true,
    showConfirmationId: true,
  });
  expect(mockFeature).toHaveBeenCalledWith('confirmation-screen', scope);
});

it('makes no setting available while the group is off', async () => {
  featureOff('confirmation-screen');
  await expect(confirmationSettingAvailability(scope)).resolves.toEqual({
    allowSubmitterEmailCopy: false,
    showConfirmationId: false,
  });
});

it('takes each setting off with its own feature', async () => {
  featureOff('confirmation-id-visibility');
  await expect(confirmationSettingAvailability(scope)).resolves.toEqual({
    allowSubmitterEmailCopy: true,
    showConfirmationId: false,
  });
});
