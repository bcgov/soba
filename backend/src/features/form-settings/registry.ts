import type { FormSettingsModule } from './types';
import { audienceSettingsModule } from './audience';
import { submitterSettingsModule } from './submitter';

/** Every form settings group, lowest weight first. Add a group here to mount it. */
export const formSettingsModules: FormSettingsModule[] = [
  audienceSettingsModule,
  submitterSettingsModule,
].sort((a, b) => a.weight - b.weight);
