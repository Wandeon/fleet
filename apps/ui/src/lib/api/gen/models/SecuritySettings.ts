/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type SecuritySettings = {
  nightMode: {
    escalationEnabled: boolean;
    alertChannels: Array<'slack' | 'email' | 'sms'>;
    updatedAt: string;
  };
};

