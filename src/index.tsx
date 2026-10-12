import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import { FlowlyPlugin } from './FlowlyPlugin';

const uuid = document.currentScript?.getAttribute('uuid') || 'root';
const pluginName = document.currentScript?.getAttribute('pluginName') || 'plugin';

const root = ReactDOM.createRoot(document.getElementById(uuid)!);
root.render(
  <React.StrictMode>
    <FlowlyPlugin pluginUuid={uuid} pluginName={pluginName} />
  </React.StrictMode>,
);
