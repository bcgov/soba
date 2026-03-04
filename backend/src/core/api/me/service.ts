import { findAppUserById } from '../../db/repos/appUserRepo';
import { toAppUserView } from '../../db/appUserView';

export class MeApiService {
  async get(actorId: string) {
    const user = await findAppUserById(actorId);
    if (!user) return null;
    const view = toAppUserView(user);
    return {
      actor: {
        id: view.id,
        displayLabel: view.displayLabel,
        status: view.status,
      },
      profile: {
        displayName: view.displayName,
        email: view.email,
        preferredUsername: view.preferredUsername,
      },
    };
  }
}

export const meApiService = new MeApiService();
