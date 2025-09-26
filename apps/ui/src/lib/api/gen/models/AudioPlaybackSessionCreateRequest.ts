/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { AudioPlaybackRequest } from './AudioPlaybackRequest';

export type AudioPlaybackSessionCreateRequest = (AudioPlaybackRequest & {
  /**
   * Optional session label displayed in operator UI.
   */
  label?: string | null;
});

