/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { ApiAccessSettings } from './ApiAccessSettings';
import type { OperatorAccount } from './OperatorAccount';
import type { OperatorRole } from './OperatorRole';
import type { PairingStatus } from './PairingStatus';
import type { ProxySettings } from './ProxySettings';

export type SettingsState = {
  api: ApiAccessSettings;
  proxy: ProxySettings;
  pairing: PairingStatus;
  operators: Array<OperatorAccount>;
  roles: Array<OperatorRole>;
  pendingRestart: boolean;
  lastSavedAt: string | null;
};

