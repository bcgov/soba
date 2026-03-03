import { Request, Response } from 'express';
import { metaApiService } from './service';
import { asyncHandler } from '../shared/asyncHandler';
import { codeService } from '../../services/codeService';

export const getPluginsMeta = (_req: Request, res: Response) => {
  res.json(metaApiService.getPlugins());
};

export const getFeaturesMeta = asyncHandler(async (_req: Request, res: Response) => {
  res.json(await metaApiService.getFeatures());
});

export const getFormEnginesMeta = asyncHandler(async (_req: Request, res: Response) => {
  res.json(await metaApiService.getFormEngines());
});

export const getBuildMeta = (_req: Request, res: Response) => {
  res.json(metaApiService.getBuild());
};

export const getCodesMeta = asyncHandler(async (req: Request, res: Response) => {
  const onlyEnabledFeatures = req.query.only_enabled_features === 'true';
  const codeSets = await codeService.getRegisteredCodeSets({ onlyEnabledFeatures });
  res.json({ codeSets });
});

export const getCodesBySetMeta = asyncHandler(async (req: Request, res: Response) => {
  const codeSet = req.params.codeSet as string;
  const activeOnly = req.query.active_only === 'true';
  const codeSets = await codeService.getRegisteredCodeSets();
  const registryRow = codeSets.find((r) => r.codeSet === codeSet);
  if (!registryRow) {
    res.status(404).json({ error: 'Code set not found' });
    return;
  }
  if (registryRow.providerType === 'feature' && registryRow.featureCode) {
    const { getFeatureByCode } = await import('../../db/repos/featureRepo');
    const feature = await getFeatureByCode(registryRow.featureCode);
    if (!feature || feature.status !== 'enabled') {
      res.status(404).json({ error: 'Feature not enabled' });
      return;
    }
  }
  const items = await codeService.getCodes(codeSet, { activeOnly });
  res.json({
    items: items.map((row) => ({
      code: row.code,
      display: row.display,
      sort_order: row.sortOrder,
      is_active: row.isActive,
    })),
  });
});

export const getRolesMeta = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as {
    limit?: number;
    cursor?: string;
    only_enabled_features?: 'true' | 'false';
  };
  const result = await metaApiService.getRolesPaginated({
    limit: query.limit ?? 20,
    cursor: query.cursor,
    onlyEnabledFeatures: query.only_enabled_features === 'true',
  });
  res.json(result);
});

export const getRoleByCodeMeta = asyncHandler(async (req: Request, res: Response) => {
  const roleCode = req.params.roleCode as string;
  const onlyEnabledFeatures = req.query.only_enabled_features !== 'false';
  const role = await metaApiService.getRole(roleCode, { onlyEnabledFeatures });
  if (!role) {
    res.status(404).json({ error: 'Role not found' });
    return;
  }
  res.json({
    roleCode: role.code,
    name: role.name,
    description: role.description,
    status: role.status,
    createdAt: role.createdAt.toISOString(),
    updatedAt: role.updatedAt.toISOString(),
  });
});
