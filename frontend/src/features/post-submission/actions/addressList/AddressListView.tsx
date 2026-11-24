'use client';

import { statusText } from '@/src/features/post-submission/actions/status';
import type { ActionViewProps } from '@/src/features/post-submission/actions/types';
import styles from '../fields.module.css';
import { addressesOf } from './addresses';

/** An address-list action's values read-only: whether it runs, and its recipients as a plain list. */
export default function AddressListView({
  dict,
  values,
  testIdPrefix,
}: ActionViewProps & Readonly<{ testIdPrefix: string }>) {
  const t = dict.postSubmission.addressList;
  const addresses = addressesOf(values);
  return (
    <div className={styles.fields} data-testid={`${testIdPrefix}-view`}>
      <p>{statusText(dict, values.enabled)}</p>
      <div>
        <p>{t.recipients}</p>
        {addresses.length > 0 ? (
          <ul className={styles.list} data-testid={`${testIdPrefix}-view-list`}>
            {addresses.map((address) => (
              <li key={address}>{address}</li>
            ))}
          </ul>
        ) : (
          <p>{t.none}</p>
        )}
      </div>
    </div>
  );
}
