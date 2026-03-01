import {
  toAppUserView,
  toSessionUser,
  type AppUserRow,
  type AppUserView,
} from '../../../src/core/db/appUserView';

describe('appUserView', () => {
  it('toAppUserView resolves displayName email preferredUsername from profile', () => {
    const row: AppUserRow = {
      id: 'user-1',
      displayLabel: 'Label',
      profile: { displayName: 'D', email: 'a@b.com', preferredUsername: 'u1' },
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: null,
      updatedBy: null,
    } as AppUserRow;
    const view = toAppUserView(row);
    expect(view.id).toBe('user-1');
    expect(view.displayName).toBe('D');
    expect(view.email).toBe('a@b.com');
    expect(view.preferredUsername).toBe('u1');
    expect(view.displayLabel).toBe('Label');
    expect(view.status).toBe('active');
  });

  it('toAppUserView uses profileHelpers for raw idp_attributes', () => {
    const row: AppUserRow = {
      id: 'user-2',
      displayLabel: null,
      profile: { name: 'From Name', user_principal_name: 'x@y.com' },
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: null,
      updatedBy: null,
    } as AppUserRow;
    const view = toAppUserView(row);
    expect(view.displayName).toBe('From Name');
    expect(view.email).toBe('x@y.com');
  });

  it('toSessionUser returns minimal session shape from view', () => {
    const view: AppUserView = {
      id: 'user-1',
      displayLabel: 'L',
      displayName: 'D',
      email: 'e@b.com',
      preferredUsername: 'u',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: null,
      updatedBy: null,
    } as AppUserView;
    const session = toSessionUser(view);
    expect(session).toEqual({
      id: 'user-1',
      displayLabel: 'L',
      displayName: 'D',
      email: 'e@b.com',
      preferredUsername: 'u',
      status: 'active',
    });
  });
});
