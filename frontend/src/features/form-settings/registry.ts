import { formSection } from './form';
import { profileSection } from './profile';
import { submitterSection } from './submitter';
import { templatesSection } from './templates';
import type { FormSettingsSection } from './types';

/** Every section of a form's Settings tab, lowest weight first. Add a section here to show it. */
export const formSettingsSections: FormSettingsSection[] = [
  formSection,
  profileSection,
  submitterSection,
  templatesSection,
].sort((a, b) => a.weight - b.weight);
