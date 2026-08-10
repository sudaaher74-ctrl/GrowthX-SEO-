"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.otelSDK = exports.prometheusExporter = void 0;
exports.startOpenTelemetry = startOpenTelemetry;
exports.shutdownOpenTelemetry = shutdownOpenTelemetry;
const sdk_node_1 = require("@opentelemetry/sdk-node");
const auto_instrumentations_node_1 = require("@opentelemetry/auto-instrumentations-node");
const exporter_prometheus_1 = require("@opentelemetry/exporter-prometheus");
const common_1 = require("@nestjs/common");
const logger = new common_1.Logger('OpenTelemetry');
const port = process.env.PROMETHEUS_PORT ? parseInt(process.env.PROMETHEUS_PORT, 10) : 9464;
const endpoint = '/metrics';
exports.prometheusExporter = new exporter_prometheus_1.PrometheusExporter({
    port,
    endpoint,
});
exports.otelSDK = new sdk_node_1.NodeSDK({
    serviceName: process.env.OTEL_SERVICE_NAME || 'growthx-ai-crawler',
    metricReader: exports.prometheusExporter,
    instrumentations: [
        (0, auto_instrumentations_node_1.getNodeAutoInstrumentations)({
            '@opentelemetry/instrumentation-fs': {
                enabled: false,
            },
        }),
    ],
});
function startOpenTelemetry() {
    try {
        exports.otelSDK.start();
        logger.log(`OpenTelemetry initialized. Prometheus metrics available at http://localhost:${port}${endpoint}`);
    }
    catch (error) {
        logger.error('Error starting OpenTelemetry SDK', error);
    }
}
function shutdownOpenTelemetry() {
    return exports.otelSDK.shutdown();
}
//# sourceMappingURL=opentelemetry.config.js.map