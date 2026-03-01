import {
  buildFormVersionCreateTopic,
  buildSubmissionCreateTopic,
} from '../../../../src/core/integrations/form-engine/formEngineTopics';

describe('formEngineTopics', () => {
  it('buildFormVersionCreateTopic returns topic with engine code', () => {
    expect(buildFormVersionCreateTopic('formio-v5')).toBe(
      'form_engine.formio-v5.form_version.create',
    );
  });

  it('buildSubmissionCreateTopic returns topic with engine code', () => {
    expect(buildSubmissionCreateTopic('formio-v5')).toBe('form_engine.formio-v5.submission.create');
  });

  it('buildFormVersionCreateTopic uses given engineCode in string', () => {
    expect(buildFormVersionCreateTopic('custom')).toBe('form_engine.custom.form_version.create');
  });

  it('buildSubmissionCreateTopic uses given engineCode in string', () => {
    expect(buildSubmissionCreateTopic('custom')).toBe('form_engine.custom.submission.create');
  });
});
