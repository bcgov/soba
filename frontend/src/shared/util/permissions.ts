import { Permissions, PermissionCode } from '@/src/types/permissions';

export const hasPermission = (
  userPermissions: Array<PermissionCode> | undefined,
  userPermission: PermissionCode | undefined,
) => {
  if (!userPermissions || !userPermission) {
    return undefined;
  }
  return userPermissions.includes(Permissions.all) || userPermissions.includes(userPermission);
};
