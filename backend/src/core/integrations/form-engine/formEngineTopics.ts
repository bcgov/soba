export const buildFormVersionCreateTopic = (engineCode: string): string =>
  `form_engine.${engineCode}.form_version.create`;

export const buildSubmissionCreateTopic = (engineCode: string): string =>
  `form_engine.${engineCode}.submission.create`;
