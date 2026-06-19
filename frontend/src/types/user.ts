export type CurrentUserResponse = {
  actor: {
    id: string;
    displayLabel: string | null;
    status: string;
  };
  profile: {
    displayName: string | null;
    email: string | null;
    preferredUsername: string | null;
  };
  preferences: {
    defaultWorkspaceId: string | null;
  };
};

export type PatchCurrentUserBody = {
  preferences: {
    defaultWorkspaceId?: string | null;
  };
};
