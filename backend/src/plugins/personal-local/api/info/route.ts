import express from 'express';
import { createGetPersonalLocalInfoController } from './controller';

export const createPersonalLocalInfoRouter = (settings: {
  cookieKey: string;
  allowHeaderOverride: boolean;
}) => {
  const router = express.Router();

  router.get('/info', createGetPersonalLocalInfoController(settings));

  return router;
};
