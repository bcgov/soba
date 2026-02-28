import { NextFunction, Request, RequestHandler, Response } from 'express';
import { z, ZodTypeAny } from 'zod';

type RequestSchemas = {
  body?: ZodTypeAny;
  params?: ZodTypeAny;
  query?: ZodTypeAny;
};

const toErrorResponse = (issue: z.ZodIssue) => ({
  path: issue.path.join('.'),
  message: issue.message,
  code: issue.code,
});

export const validateRequest = (schemas: RequestSchemas): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (schemas.body) {
      const bodyResult = schemas.body.safeParse(req.body);
      if (!bodyResult.success) {
        return res.status(400).json({
          error: 'Invalid request body',
          details: bodyResult.error.issues.map(toErrorResponse),
        });
      }
      req.body = bodyResult.data;
    }

    if (schemas.params) {
      const paramsResult = schemas.params.safeParse(req.params);
      if (!paramsResult.success) {
        return res.status(400).json({
          error: 'Invalid request params',
          details: paramsResult.error.issues.map(toErrorResponse),
        });
      }
      req.params = paramsResult.data as Request['params'];
    }

    if (schemas.query) {
      const queryResult = schemas.query.safeParse(req.query);
      if (!queryResult.success) {
        return res.status(400).json({
          error: 'Invalid request query',
          details: queryResult.error.issues.map(toErrorResponse),
        });
      }
      req.query = queryResult.data as Request['query'];
    }

    next();
  };
};
