import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { Logger } from '@nestjs/common';

const logger = new Logger('OpenTelemetry');

const port = process.env.PROMETHEUS_PORT ? parseInt(process.env.PROMETHEUS_PORT, 10) : 9464;
const endpoint = '/metrics';

export const prometheusExporter = new PrometheusExporter({
  port,
  endpoint,
});

export const otelSDK = new NodeSDK({
  serviceName: process.env.OTEL_SERVICE_NAME || 'growthx-ai-crawler',
  metricReader: prometheusExporter,
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': {
        enabled: false,
      },
    }),
  ],
});

export function startOpenTelemetry(): void {
  try {
    otelSDK.start();
    logger.log(`OpenTelemetry initialized. Prometheus metrics available at http://localhost:${port}${endpoint}`);
  } catch (error) {
    logger.error('Error starting OpenTelemetry SDK', error);
  }
}

export function shutdownOpenTelemetry(): Promise<void> {
  return otelSDK.shutdown();
}
