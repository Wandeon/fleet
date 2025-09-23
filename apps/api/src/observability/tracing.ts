import os from 'node:os';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base';

let sdk: NodeSDK | null = null;

const serviceName = process.env.OTEL_SERVICE_NAME || 'fleet-api';
const serviceVersion =
  process.env.LOG_COMMIT ||
  process.env.FLEET_COMMIT ||
  process.env.GIT_COMMIT ||
  process.env.COMMIT_SHA ||
  'unknown';

export async function startTracing() {
  if (process.env.OTEL_TRACING_DISABLED === '1' || process.env.OTEL_TRACING_DISABLED === 'true') {
    return;
  }

  if (sdk) {
    return;
  }

  const exporter = new ConsoleSpanExporter();

  sdk = new NodeSDK({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
      [SemanticResourceAttributes.SERVICE_VERSION]: serviceVersion,
      [SemanticResourceAttributes.SERVICE_NAMESPACE]: 'fleet',
      [SemanticResourceAttributes.HOST_NAME]: process.env.LOG_HOST || os.hostname(),
    }),
    traceExporter: exporter,
    instrumentations: [getNodeAutoInstrumentations()],
  });

  await sdk.start();

  const shutdown = async () => {
    await shutdownTracing();
  };

  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

export async function shutdownTracing() {
  if (!sdk) return;
  await sdk.shutdown().catch((error) => {
    // eslint-disable-next-line no-console
    console.error('failed to shutdown tracing', error);
  });
  sdk = null;
}
