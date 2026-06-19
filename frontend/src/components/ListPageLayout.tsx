'use client';

import type { ReactNode } from 'react';
import styles from './ListPageLayout.module.css';

type ListPageLayoutProps = {
  children: ReactNode;
};

type ListPageToolbarProps = {
  children: ReactNode;
  align?: 'between' | 'end';
};

export function ListPageLayout({ children }: ListPageLayoutProps) {
  return <div className={styles.container}>{children}</div>;
}

export function ListPageToolbar({ children, align = 'between' }: ListPageToolbarProps) {
  return (
    <div className={align === 'end' ? styles.toolbarEnd : styles.toolbar}>{children}</div>
  );
}

export function ListPageAuthGate({ children }: { children: ReactNode }) {
  return <div className={styles.authGate}>{children}</div>;
}
