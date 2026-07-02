import React from 'react';
import { Modal as BSModal } from 'react-bootstrap';

export interface ModalProps {
  show: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  size?: 'sm' | 'lg' | 'xl';
  footer?: React.ReactNode;
  scrollable?: boolean;
}

export function Modal({
  show,
  title,
  onClose,
  children,
  size = 'lg',
  footer,
  scrollable = true,
}: ModalProps) {
  return (
    <BSModal show={show} onHide={onClose} size={size} centered scrollable={scrollable} data-test-id={title + '-modal'}>
      <BSModal.Header closeButton>
        <BSModal.Title>{title}</BSModal.Title>
      </BSModal.Header>
      <BSModal.Body className="bg-light">
        <div className="p-3 bg-white border rounded">{children}</div>
      </BSModal.Body>
      {footer && <BSModal.Footer>{footer}</BSModal.Footer>}
    </BSModal>
  );
}
