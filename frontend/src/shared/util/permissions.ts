import { Permissions, PermissionCode } from '@/src/types/permissions';

export const hasPermission = (
  userPermissions: Array<PermissionCode>,
  userPermission: PermissionCode,
) => {
  if (!userPermissions) {
    return undefined;
  }
  return userPermissions.includes(Permissions.all) || userPermissions.includes(userPermission);
};
