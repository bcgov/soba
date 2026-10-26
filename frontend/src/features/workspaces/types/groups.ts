export interface WorkspaceGroup {
  id: string;
  name: string;
  description: string | null;
  status: string;
  system: boolean;
  roles: string[];
}

export interface RoleMeta {
  roleCode: string;
  name: string;
  description: string | null;
}

export interface CreateGroupInput {
  name: string;
  description?: string;
  roleCodes: string[];
}

export interface UpdateGroupInput {
  name?: string;
  description?: string | null;
  roleCodes?: string[];
}
