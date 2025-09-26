/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { OperatorAccount } from './OperatorAccount';
import type { ProxySettings } from './ProxySettings';
import type { SecuritySettings } from './SecuritySettings';
import type { SettingsPairingState } from './SettingsPairingState';

export type SettingsState = {
  proxy: ProxySettings;
  allowedOrigins: Array<string>;
  pairing: SettingsPairingState;
  operators: Array<OperatorAccount>;
  apiTokenPreview: string;
  security: SecuritySettings;
  updatedAt: string | null;
};

