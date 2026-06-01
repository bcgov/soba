'use client';

import { Button } from 'react-bootstrap';
import { useKeycloak } from '@/lib/hooks/useKeycloak';

interface LoginButtonProps {
  label?: string;
}

export function LoginButton({ label = 'Log in' }: LoginButtonProps) {
  const { login } = useKeycloak();

  return (
    <Button
      id="login-button"
      type="button"
      variant="primary"
      data-testid="login-button"
      onClick={() => login()}
    >
      {label}
    </Button>
  );
}
