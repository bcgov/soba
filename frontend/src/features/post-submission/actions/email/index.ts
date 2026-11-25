import { addressListAction } from '../addressList';

/** Emails a notice to a list of addresses. */
export const emailAddressesAction = addressListAction({
  copy: (dict) => dict.postSubmission.email,
  testIdPrefix: 'post-submission-email',
});
