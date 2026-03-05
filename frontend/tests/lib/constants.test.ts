import { describe, it, expect } from 'vitest';
import { NotificationTypes } from '@/lib/constants';

describe('NotificationTypes', () => {
  it('defines INFO type', () => {
    expect(NotificationTypes.INFO).toEqual({ type: 'info' });
  });

  it('defines SUCCESS type', () => {
    expect(NotificationTypes.SUCCESS).toEqual({ type: 'success' });
  });

  it('defines WARNING type', () => {
    expect(NotificationTypes.WARNING).toEqual({ type: 'warning' });
  });

  it('defines ERROR type', () => {
    expect(NotificationTypes.ERROR).toEqual({ type: 'error' });
  });

  it('covers all four notification types', () => {
    expect(Object.keys(NotificationTypes)).toHaveLength(4);
  });
});
