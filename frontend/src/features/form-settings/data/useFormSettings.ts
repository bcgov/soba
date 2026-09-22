import { sessionReadConfig } from '@/src/shared/api/swrConfig';
import { useAuthedSWR } from '@/src/shared/api/useAuthedSWR';
import { getFormSettings, setFormSettings } from './api';

/** A settings group of a form, and a save that puts the saved settings in the cache. */
export function useFormSettings<TSettings, TBody = TSettings>(key: string, formId: string) {
  const { data, error, mutate } = useAuthedSWR<TSettings>(
    ['form-settings', key, formId],
    (token) => getFormSettings<TSettings>(token, formId, key),
    sessionReadConfig,
  );

  const save = async (token: string, body: TBody): Promise<void> => {
    await mutate(setFormSettings<TBody, TSettings>(token, formId, key, body), {
      revalidate: false,
    });
  };

  return { settings: data, error, save };
}
