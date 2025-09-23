import type {
  AudioState,
  CameraState,
  ConnectionProbe,
  LayoutData,
  LogsData,
  VideoState,
  ZigbeeState
} from '$lib/types';

interface StateMock {
  connection: ConnectionProbe;
  build: {
    commit: string;
    version: string;
  };
}

const mockModules = import.meta.glob('./mocks/*.json', { eager: true }) as Record<string, { default: unknown }>;

function readMock<T>(name: string): T {
  const module = mockModules[`./mocks/${name}.json`];
  if (!module) {
    throw new Error(`Mock data for ${name} not found`);
  }

  const value = module.default as T;
  return structuredClone ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}

export const mockApi = {
  layout(): LayoutData {
    return readMock<LayoutData>('layout');
  },
  state(): StateMock {
    return readMock<StateMock>('state');
  },
  audio(): AudioState {
    return readMock<AudioState>('audio');
  },
  video(): VideoState {
    return readMock<VideoState>('video');
  },
  zigbee(): ZigbeeState {
    return readMock<ZigbeeState>('zigbee');
  },
  camera(): CameraState {
    return readMock<CameraState>('camera');
  },
  logs(): LogsData {
    return readMock<LogsData>('logs');
  }
};
