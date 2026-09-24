import { TenantSchema, ListTenantsResponseSchema } from '../../src/schemas/tenants';

describe('Tenant Schemas', () => {
  describe('TenantSchema', () => {
    it('validates a complete tenant', () => {
      const data = {
        id: '123',
        name: 'Test Tenant',
        ministryName: 'Ministry of Test',
        description: 'A test tenant',
        createdDateTime: '2021-01-01T00:00:00Z',
        updatedDateTime: '2021-01-01T00:00:00Z',
        createdBy: 'user1',
        createdByUserName: 'user.one',
        createdByDisplayName: 'User One',
        updatedBy: 'user2'
      };
      
      const result = TenantSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('validates a tenant with missing optional fields', () => {
      const data = {
        id: '123',
        name: 'Test Tenant',
        ministryName: 'Ministry of Test',
        createdDateTime: '2021-01-01T00:00:00Z',
        updatedDateTime: '2021-01-01T00:00:00Z',
        createdBy: 'user1',
      };
      
      const result = TenantSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('fails if required fields are missing', () => {
      const data = {
        id: '123',
        name: 'Test Tenant',
      };
      
      const result = TenantSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe('ListTenantsResponseSchema', () => {
    it('validates a list of tenants', () => {
      const data = {
        tenants: [
          {
            id: '123',
            name: 'Test Tenant',
            ministryName: 'Ministry of Test',
            createdDateTime: '2021-01-01T00:00:00Z',
            updatedDateTime: '2021-01-01T00:00:00Z',
            createdBy: 'user1',
          }
        ]
      };
      const result = ListTenantsResponseSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });
});
