import { getRoleByCode, listRoles } from '../db/repos/roleRepo';
import { getByRoleCode, listRegistry, listRegistryPaginated } from '../db/repos/roleRegistryRepo';
import { FeatureStatus } from '../db/codes';

export interface RegisteredRole {
  roleCode: string;
  providerType: string;
  featureCode: string | null;
}

export interface RoleRow {
  code: string;
  name: string;
  description: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export const roleService = {
  async getRegisteredRoles(options?: { onlyEnabledFeatures?: boolean }): Promise<RegisteredRole[]> {
    return listRegistry(options);
  },

  async getRegisteredRolesPaginated(options: {
    limit: number;
    afterRoleCode?: string;
    onlyEnabledFeatures?: boolean;
  }): Promise<{ items: RegisteredRole[]; hasMore: boolean }> {
    return listRegistryPaginated(options);
  },

  async getRole(
    roleCode: string,
    options?: { onlyEnabledFeatures?: boolean },
  ): Promise<RoleRow | null> {
    const registryRow = await getByRoleCode(roleCode);
    if (!registryRow) return null;
    if (
      registryRow.providerType === 'feature' &&
      registryRow.featureCode &&
      options?.onlyEnabledFeatures !== false
    ) {
      const { getFeatureByCode } = await import('../db/repos/featureRepo');
      const feature = await getFeatureByCode(registryRow.featureCode);
      if (feature?.status !== FeatureStatus.enabled) return null;
    }
    return getRoleByCode(roleCode);
  },

  async listRoles(options?: { onlyEnabledFeatures?: boolean }): Promise<RoleRow[]> {
    return listRoles(options);
  },

  async isValidRole(
    roleCode: string,
    options?: { onlyEnabledFeatures?: boolean },
  ): Promise<boolean> {
    const row = await this.getRole(roleCode, options);
    return row !== null;
  },
};
