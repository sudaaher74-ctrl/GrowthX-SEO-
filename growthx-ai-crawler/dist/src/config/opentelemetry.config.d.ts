import { NodeSDK } from '@opentelemetry/sdk-node';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
export declare const prometheusExporter: PrometheusExporter;
export declare const otelSDK: NodeSDK;
export declare function startOpenTelemetry(): void;
export declare function shutdownOpenTelemetry(): Promise<void>;
