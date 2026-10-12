import * as React from 'react';
import { usePluginContext } from '../core/plugin/PluginContext';
import { useCompanyTheme } from './hooks/useCompanyStyles';

/**
 * Module responsible for applying company branding and theme.
 * Handles theme application and logo insertion in the BBB interface.
 */
export const CompanyThemeModule: React.FC = () => {
  usePluginContext();

  // Apply company theme and logo (initialization is handled within the hook)
  useCompanyTheme();

  return null;
};

export default CompanyThemeModule;
