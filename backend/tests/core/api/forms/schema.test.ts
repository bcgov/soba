import { SaveFormVersionBodySchema } from '../../../../src/core/api/forms/schema';

describe('SaveFormVersionBodySchema', () => {
  it('keeps only the event type and note', () => {
    const result = SaveFormVersionBodySchema.safeParse({
      eventType: 'save_draft',
      note: 'Reworded the intro',
      engine_schema_ref: 'another-form',
      formioFormDefinition: { components: [] },
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual({ eventType: 'save_draft', note: 'Reworded the intro' });
  });
});
