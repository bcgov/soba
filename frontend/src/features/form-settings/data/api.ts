import { sobaFetch } from '@/src/shared/api/sobaFetch';
import { parseJson } from '@/src/shared/api/sobaHelpers';

const settingsPath = (formId: string, key: string) => `/design/forms/${formId}/settings/${key}`;

/** A settings group of a form. */
export async function getFormSettings<TSettings>(
  token: string,
  formId: string,
  key: string,
): Promise<TSettings> {
  const response = await sobaFetch(settingsPath(formId, key), { token });
  return parseJson(response);
}

/** Saves a settings group of a form; resolves to the saved settings. */
export async function setFormSettings<TBody, TSettings>(
  token: string,
  formId: string,
  key: string,
  body: TBody,
): Promise<TSettings> {
  const response = await sobaFetch(settingsPath(formId, key), {
    token,
    method: 'PUT',
    json: body,
  });
  return parseJson(response);
}
