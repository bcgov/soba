export type TeamGroup = {
  id: string;
  name: string;
};

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  /** Ids of the groups the member belongs to. */
  groups: string[];
};

/** A user found by the add-member search, not yet on the team. */
export type UserSearchResult = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  identityProvider: string;
};
