import { Request, Response } from 'express';
import { createPersonalLocalInfoService } from './service';

export const createGetPersonalLocalInfoController = (settings: {
  cookieKey: string;
  allowHeaderOverride: boolean;
}) => {
  const service = createPersonalLocalInfoService(settings);

  return (_req: Request, res: Response) => {
    res.json(service.getInfo());
  };
};
