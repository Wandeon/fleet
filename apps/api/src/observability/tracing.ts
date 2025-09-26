import os from 'node:os';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
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

export function startTracing() {
  if (process.env.OTEL_TRACING_DISABLED === '1' || process.env.OTEL_TRACING_DISABLED === 'true') {
    return;
  }

  if (sdk) {
    return;
  }

  const exporter = new ConsoleSpanExporter();

  const resource = resourceFromAttributes({
    [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
    [SemanticResourceAttributes.SERVICE_VERSION]: serviceVersion,
    [SemanticResourceAttributes.SERVICE_NAMESPACE]: 'fleet',
    [SemanticResourceAttributes.HOST_NAME]: process.env.LOG_HOST || os.hostname(),
  });

  sdk = new NodeSDK({
    resource,
    traceExporter: exporter,
    instrumentations: [getNodeAutoInstrumentations()],
  });

  sdk.start();

  const shutdown = async () => {
    await shutdownTracing();
  };

  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

export async function shutdownTracing() {
  if (!sdk) return;
  await sdk.shutdown().catch((error) => {
    console.error('failed to shutdown tracing', error);
  });
  sdk = null;
}
