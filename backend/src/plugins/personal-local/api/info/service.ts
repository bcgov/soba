export interface PersonalLocalInfo {
  code: 'personal-local';
  mode: 'personal';
  cookieKey: string;
  allowHeaderOverride: boolean;
}

export const createPersonalLocalInfoService = (settings: {
  cookieKey: string;
  allowHeaderOverride: boolean;
}) => ({
  getInfo(): PersonalLocalInfo {
    return {
      code: 'personal-local',
      mode: 'personal',
      cookieKey: settings.cookieKey,
      allowHeaderOverride: settings.allowHeaderOverride,
    };
  },
});
