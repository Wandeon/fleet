/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type SecurityUpdateRequest = {
  nightMode: {
    escalationEnabled?: boolean;
    alertChannels?: Array<'slack' | 'email' | 'sms'>;
  };
};
