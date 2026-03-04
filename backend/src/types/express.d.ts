declare global {
  namespace Express {
    interface Request {
      decodedJwt?: Record<string, unknown>;
      authPayload?: Record<string, unknown>;
      bceidType?: 'bceidbasic' | 'bceidbusiness';
      idpType?: string;
      idpPluginCode?: string;
      coreContext?: import('../core/middleware/requestContext').CoreRequestContext;
      actorId?: string;
      isSobaAdmin?: boolean;
    }
  }
}

export {};
