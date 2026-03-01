import {
  parseFormVersionCreatePayload,
  parseSubmissionCreatePayload,
} from '../../../../src/core/integrations/queue/events';

describe('events', () => {
  it('parseFormVersionCreatePayload accepts valid payload', () => {
    const payload = {
      formVersionId: '11111111-1111-4111-a111-111111111111',
      engineCode: 'formio-v5',
    };
    const result = parseFormVersionCreatePayload(payload);
    expect(result.formVersionId).toBe(payload.formVersionId);
    expect(result.engineCode).toBe(payload.engineCode);
    expect(result.formId).toBeUndefined();
  });

  it('parseFormVersionCreatePayload accepts payload with optional formId', () => {
    const payload = {
      formVersionId: '11111111-1111-4111-a111-111111111111',
      engineCode: 'formio-v5',
      formId: '22222222-2222-4222-a222-222222222222',
    };
    const result = parseFormVersionCreatePayload(payload);
    expect(result.formId).toBe(payload.formId);
  });

  it('parseFormVersionCreatePayload throws on invalid formVersionId', () => {
    expect(() =>
      parseFormVersionCreatePayload({
        formVersionId: 'not-a-uuid',
        engineCode: 'formio-v5',
      }),
    ).toThrow();
  });

  it('parseFormVersionCreatePayload throws on missing engineCode', () => {
    expect(() =>
      parseFormVersionCreatePayload({
        formVersionId: '11111111-1111-4111-a111-111111111111',
      }),
    ).toThrow();
  });

  it('parseSubmissionCreatePayload accepts valid payload', () => {
    const payload = {
      submissionId: '11111111-1111-4111-a111-111111111111',
      engineCode: 'formio-v5',
    };
    const result = parseSubmissionCreatePayload(payload);
    expect(result.submissionId).toBe(payload.submissionId);
    expect(result.engineCode).toBe(payload.engineCode);
    expect(result.formVersionId).toBeUndefined();
  });

  it('parseSubmissionCreatePayload accepts payload with optional formVersionId', () => {
    const payload = {
      submissionId: '11111111-1111-4111-a111-111111111111',
      engineCode: 'formio-v5',
      formVersionId: '22222222-2222-4222-a222-222222222222',
    };
    const result = parseSubmissionCreatePayload(payload);
    expect(result.formVersionId).toBe(payload.formVersionId);
  });

  it('parseSubmissionCreatePayload throws on invalid submissionId', () => {
    expect(() =>
      parseSubmissionCreatePayload({
        submissionId: 'not-a-uuid',
        engineCode: 'formio-v5',
      }),
    ).toThrow();
  });

  it('parseSubmissionCreatePayload throws on empty engineCode', () => {
    expect(() =>
      parseSubmissionCreatePayload({
        submissionId: '11111111-1111-4111-a111-111111111111',
        engineCode: '',
      }),
    ).toThrow();
  });
});
