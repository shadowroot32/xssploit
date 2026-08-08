/**
 * @xssploit/engine — public API surface.
 */
export { Scanner, defaultScanConfig, payloadsRootFrom, type ScannerOptions } from './scanner.js';
export { HTTPClient, type HttpResponse } from './utils/http-client.js';
export { createLogger } from './utils/logger.js';
export { RateLimiter } from './network/rate-limiter.js';
export { UARotator } from './network/ua-rotator.js';
export { Spider } from './core/crawler/spider.js';
export { TechDetector } from './core/crawler/tech-detector.js';
export { InjectionEngine } from './core/injector/injection-engine.js';
export { PayloadLoader } from './core/injector/payload-loader.js';
export { PayloadMutator } from './core/injector/payload-mutator.js';
export { ResponseAnalyzer } from './core/analyzer/response-analyzer.js';
export { ReflectionDetector } from './core/analyzer/reflection-detector.js';
export { CSPAnalyzer } from './core/analyzer/csp-analyzer.js';
export { JSStaticAnalyzer } from './core/analyzer/js-static-analyzer.js';
export { findSecrets } from './core/analyzer/secret-finder.js';
export { ScopeManager } from './core/scope/scope-manager.js';
export { AuthManager } from './core/auth/auth-manager.js';
export { ProviderManager } from './core/ai/provider-manager.js';
export { NoAIProvider } from './core/ai/providers/no-ai-provider.js';
export { CallbackServer } from './core/callback/server.js';
export { CallbackPayloadGenerator } from './core/callback/payload-generator.js';
export { NotificationManager } from './core/callback/notification.js';
export { DataCollector } from './core/callback/data-collector.js';
export { ReportBuilder } from './reports/generator/report-builder.js';
export { encoders } from './utils/encoder.js';
