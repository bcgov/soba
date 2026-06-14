'use client';

import { Button } from '@bcgov/design-system-react-components';
import { useKeycloak } from '@/lib/hooks/useKeycloak';

interface LoginButtonProps {
  label?: string;
  'data-testid'?: string;
}

export function LoginButton({ label = 'Log in', 'data-testid': testId = 'login-button' }: LoginButtonProps) {
  const { login } = useKeycloak();

  return (
    <Button
      id="login-button"
      type="button"
      variant="primary"
      data-testid={testId}
      onPress={() => login()}
    >
      {label}
    </Button>
  );
}
