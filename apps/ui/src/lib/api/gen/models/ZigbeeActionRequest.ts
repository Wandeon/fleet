/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type ZigbeeActionRequest = {
  action: 'toggle' | 'on' | 'off' | 'scene';
  /**
   * Required when action is scene.
   */
  scene?: string | null;
};

