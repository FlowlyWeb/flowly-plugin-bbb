import { ReactElement } from 'react';

export interface DropdownProps {
  isOpen: boolean;
  onClose: () => void;
  buttonId: string;
}

export interface DropdownOption {
  label: string;
  onClick: () => void;
}

export interface UseTestModuleReturn {
  dropdownComponent: ReactElement | null;
}
