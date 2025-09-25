/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type CameraEventDetection = {
  id: string;
  label: string;
  confidence: number;
  boundingBox?: {
    'x'?: number;
    'y'?: number;
    width?: number;
    height?: number;
  } | null;
};

