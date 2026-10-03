import { toInheritableSettings } from '../../../src/features/form-settings/inheritable';

const workspace = { mode: 'protected', idps: ['azureidir'] };
const own = { mode: 'public', idps: [] };

describe('toInheritableSettings', () => {
  it('applies the workspace values to a form that inherits', () => {
    expect(toInheritableSettings({ inherit: true, own: null }, workspace)).toEqual({
      inherit: true,
      own: null,
      workspace,
      effective: workspace,
    });
  });

  it("applies a form's own values when it overrides", () => {
    expect(toInheritableSettings({ inherit: false, own }, workspace)).toEqual({
      inherit: false,
      own,
      workspace,
      effective: own,
    });
  });

  // Inheriting means the workspace values apply, even if old values were somehow left on the row.
  it('ignores values left on a row that inherits', () => {
    expect(toInheritableSettings({ inherit: true, own }, workspace).effective).toBe(workspace);
  });
});
