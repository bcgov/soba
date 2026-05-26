import { metaApiService } from '../../../../src/core/api/meta/service';
import * as featureRepo from '../../../../src/core/db/repos/featureRepo';
import { FeatureStatus } from '../../../../src/core/db/codes';

describe('MetaApiService.getFeatures', () => {
  it('maps rows to platformAllowed from status', async () => {
    jest.spyOn(featureRepo, 'listFeatures').mockResolvedValue([
      {
        code: 'desiger',
        name: 'Design mode',
        description: null,
        version: null,
        status: FeatureStatus.enabled,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        code: 'x-off',
        name: 'X',
        description: null,
        version: null,
        status: FeatureStatus.disabled,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const result = await metaApiService.getFeatures();

    expect(result.features).toHaveLength(2);
    const design = result.features.find((f) => f.code === 'designer');
    expect(design?.platformAllowed).toBe(true);
    expect(design).not.toHaveProperty('enabled');
    const off = result.features.find((f) => f.code === 'x-off');
    expect(off?.platformAllowed).toBe(false);
  });
});
