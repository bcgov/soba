import type { NormalizedProfile, IdpAttributes } from '../core/auth/jwtClaims';
import type { CoreRequestContext } from '../core/middleware/requestContext';

declare global {
  namespace Express {
    interface User {
      pluginCode: string;
      authPayload: Record<string, unknown>;
      subject: string;
      providerCode: string;
      profile: NormalizedProfile;
      idpAttributes: IdpAttributes;
      sobaAdmin?: boolean;
    }

    interface Request {
      decodedJwt?: Record<string, unknown>;
      authPayload?: Record<string, unknown>;
      bceidType?: 'bceidbasic' | 'bceidbusiness';
      idpType?: string;
      idpPluginCode?: string;
      coreContext?: CoreRequestContext;
      actorId?: string;
      isSobaAdmin?: boolean;
    }
  }
}

export {};
