import { Request, Response } from 'express';
import { metaApiService } from './service';

export const getPluginsMeta = (_req: Request, res: Response) => {
  res.json(metaApiService.getPlugins());
};

export const getFeaturesMeta = (_req: Request, res: Response) => {
  res.json(metaApiService.getFeatures());
};

export const getFormEnginesMeta = async (_req: Request, res: Response) => {
  res.json(await metaApiService.getFormEngines());
};

export const getBuildMeta = (_req: Request, res: Response) => {
  res.json(metaApiService.getBuild());
};
