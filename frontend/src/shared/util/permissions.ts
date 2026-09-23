import { Permissions, PermissionCode } from '@/src/types/permissions';

export const hasPermission = (
  userPermissions: Array<PermissionCode>,
  userPermission: PermissionCode,
) => {
  return userPermissions.includes(Permissions.all) || userPermissions.includes(userPermission);
};
