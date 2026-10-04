'use client';

import { Checkbox } from '@bcgov/design-system-react-components';

/** Whether a form uses its workspace's values for a settings group. */
export default function InheritCheckbox({
  label,
  isSelected,
  onChange,
  isDisabled = false,
  testId,
}: Readonly<{
  label: string;
  isSelected: boolean;
  onChange: (inherit: boolean) => void;
  isDisabled?: boolean;
  testId: string;
}>) {
  return (
    <Checkbox
      isSelected={isSelected}
      onChange={onChange}
      isDisabled={isDisabled}
      data-testid={testId}
    >
      {label}
    </Checkbox>
  );
}
