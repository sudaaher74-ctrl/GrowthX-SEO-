import { Test, TestingModule } from '@nestjs/testing';
import { ValidatorService, ValidationResult } from './validator.service';
import axios from 'axios';
import * as tls from 'tls';
import { Website } from '@prisma/client';

jest.mock('axios');
jest.mock('tls');

describe('ValidatorService', () => {
  let service: ValidatorService;
  const mockedAxios = axios as jest.Mocked<typeof axios>;
  const mockedTls = tls as jest.Mocked<typeof tls>;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [ValidatorService],
    }).compile();

    service = module.get<ValidatorService>(ValidatorService);
  });

  function createMockSocket(options: {
    authorized?: boolean;
    validTo?: string;
    shouldTimeout?: boolean;
    emitError?: Error;
  }) {
    const socket: any = {
      authorized: options.authorized !== undefined ? options.authorized : true,
      getPeerCertificate: jest.fn().mockReturnValue(
        options.validTo ? { valid_to: options.validTo } : null,
      ),
      end: jest.fn(),
      destroy: jest.fn(),
      setTimeout: jest.fn().mockImplementation((timeoutMs: number, callback: () => void) => {
        if (options.shouldTimeout) {
          process.nextTick(callback);
        }
        return socket;
      }),
      on: jest.fn().mockImplementation((event: string, callback: (err?: any) => void) => {
        if (event === 'error' && options.emitError) {
          process.nextTick(() => callback(options.emitError));
        }
        return socket;
      }),
    };
    return socket;
  }

  function mockTlsConnect(socket: any) {
    (mockedTls.connect as jest.Mock).mockImplementation((port, host, opts, callback) => {
      if (callback) {
        process.nextTick(callback);
      }
      return socket;
    });
  }

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should validate a reachable HTTPS domain with valid SSL certificate', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 90); // 90 days in future
    const mockSocket = createMockSocket({
      authorized: true,
      validTo: futureDate.toISOString(),
    });
    mockTlsConnect(mockSocket);

    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      request: { res: { responseUrl: 'https://example.com/' } },
    } as any);

    const result = await service.validateWebsite('example.com');

    expect(result.isReachable).toBe(true);
    expect(result.isHttps).toBe(true);
    expect(result.sslValid).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(result.sslExpiryDate).toEqual(futureDate);
    expect(result.redirectChain).toEqual(['https://example.com', 'https://example.com/']);
    expect(result.finalUrl).toBe('https://example.com/');
    expect(result.errorMessage).toBeUndefined();
  });

  it('should format domain without scheme and default to https', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 30);
    const mockSocket = createMockSocket({
      authorized: true,
      validTo: futureDate.toISOString(),
    });
    mockTlsConnect(mockSocket);

    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      request: { res: { responseUrl: 'https://growthx.ai' } },
    } as any);

    const result = await service.validateWebsite('growthx.ai');
    expect(mockedTls.connect).toHaveBeenCalledWith(
      443,
      'growthx.ai',
      expect.objectContaining({ servername: 'growthx.ai', rejectUnauthorized: false }),
      expect.any(Function),
    );
    expect(mockedAxios.get).toHaveBeenCalledWith(
      'https://growthx.ai',
      expect.objectContaining({ timeout: 10000 }),
    );
    expect(result.isHttps).toBe(true);
    expect(result.isReachable).toBe(true);
  });

  it('should skip SSL certificate check when explicit http:// scheme is used', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      request: { res: { responseUrl: 'http://insecure-example.com' } },
    } as any);

    const result = await service.validateWebsite('http://insecure-example.com');

    expect(mockedTls.connect).not.toHaveBeenCalled();
    expect(result.isHttps).toBe(false);
    expect(result.sslValid).toBe(false);
    expect(result.isReachable).toBe(true);
    expect(result.statusCode).toBe(200);
  });

  it('should detect expired SSL certificate (valid_to in the past)', async () => {
    const pastDate = new Date('2023-01-01T00:00:00.000Z');
    const mockSocket = createMockSocket({
      authorized: true,
      validTo: pastDate.toISOString(),
    });
    mockTlsConnect(mockSocket);

    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      request: { res: { responseUrl: 'https://expired-ssl.com' } },
    } as any);

    const result = await service.validateWebsite('https://expired-ssl.com');

    expect(result.sslValid).toBe(false);
    expect(result.sslExpiryDate).toEqual(pastDate);
    expect(result.isReachable).toBe(true);
  });

  it('should detect unauthorized or self-signed SSL certificate', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 30);
    const mockSocket = createMockSocket({
      authorized: false, // Unauthorized / self-signed
      validTo: futureDate.toISOString(),
    });
    mockTlsConnect(mockSocket);

    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      request: { res: { responseUrl: 'https://self-signed.com' } },
    } as any);

    const result = await service.validateWebsite('https://self-signed.com');

    expect(result.sslValid).toBe(false);
    expect(result.isReachable).toBe(true);
  });

  it('should handle SSL socket errors gracefully without crashing website reachability check', async () => {
    const mockSocket = createMockSocket({
      emitError: new Error('ECONNRESET'),
    });
    (mockedTls.connect as jest.Mock).mockImplementation((_port, _host, _opts, _callback) => {
      return mockSocket;
    });

    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      request: { res: { responseUrl: 'https://example.com' } },
    } as any);

    const result = await service.validateWebsite('https://example.com');

    expect(result.sslValid).toBe(false);
    expect(result.isReachable).toBe(true);
  });

  it('should handle SSL socket timeout gracefully', async () => {
    const mockSocket = createMockSocket({
      shouldTimeout: true,
    });
    (mockedTls.connect as jest.Mock).mockImplementation((_port, _host, _opts, _callback) => {
      return mockSocket;
    });

    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      request: { res: { responseUrl: 'https://example.com' } },
    } as any);

    const result = await service.validateWebsite('https://example.com');

    expect(result.sslValid).toBe(false);
    expect(result.isReachable).toBe(true);
  });

  it('should record redirect chains properly when origin redirects', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 30);
    const mockSocket = createMockSocket({
      authorized: true,
      validTo: futureDate.toISOString(),
    });
    mockTlsConnect(mockSocket);

    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      request: { res: { responseUrl: 'https://www.example.com/landing' } },
    } as any);

    const result = await service.validateWebsite('https://example.com');

    expect(result.redirectChain).toEqual([
      'https://example.com',
      'https://www.example.com/landing',
    ]);
    expect(result.finalUrl).toBe('https://www.example.com/landing');
  });

  it('should flag HTTP 5xx responses as unreachable with an error message', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 30);
    const mockSocket = createMockSocket({
      authorized: true,
      validTo: futureDate.toISOString(),
    });
    mockTlsConnect(mockSocket);

    mockedAxios.get.mockResolvedValueOnce({
      status: 503,
      request: { res: { responseUrl: 'https://example.com' } },
    } as any);

    const result = await service.validateWebsite('https://example.com');

    expect(result.isReachable).toBe(false);
    expect(result.statusCode).toBe(503);
    expect(result.errorMessage).toContain('status code 503');
  });

  it('should handle network connection / DNS resolution failure', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 30);
    const mockSocket = createMockSocket({
      authorized: true,
      validTo: futureDate.toISOString(),
    });
    mockTlsConnect(mockSocket);

    mockedAxios.get.mockRejectedValueOnce(new Error('getaddrinfo ENOTFOUND invalid-domain-test-xyz.com'));

    const result = await service.validateWebsite('https://invalid-domain-test-xyz.com');

    expect(result.isReachable).toBe(false);
    expect(result.errorMessage).toContain('ENOTFOUND');
  });

  it('should invoke and integrate with underlying Website Prisma model', async () => {
    // Model invocation: Website entity lifecycle validation
    const targetDomain = 'growthx-audit-test.com';
    const initialWebsite: Partial<Website> = {
      id: 'website_test_1',
      domain: targetDomain,
      url: `https://${targetDomain}`,
      isVerified: false,
      rateLimitDelayMs: 500,
      maxConcurrency: 5,
      maxDepth: 10,
    };

    const futureDate = new Date(Date.now() + 86400000 * 60);
    const mockSocket = createMockSocket({
      authorized: true,
      validTo: futureDate.toISOString(),
    });
    mockTlsConnect(mockSocket);

    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      request: { res: { responseUrl: `https://${targetDomain}/` } },
    } as any);

    const validation: ValidationResult = await service.validateWebsite(initialWebsite.domain!);

    // Website model state update after validation
    const updatedWebsite: Partial<Website> = {
      ...initialWebsite,
      isVerified: validation.isReachable && validation.sslValid,
      verifiedAt: validation.isReachable && validation.sslValid ? new Date() : null,
      url: validation.finalUrl || initialWebsite.url!,
    };

    expect(updatedWebsite.isVerified).toBe(true);
    expect(updatedWebsite.verifiedAt).toBeInstanceOf(Date);
    expect(updatedWebsite.url).toBe(`https://${targetDomain}/`);
    expect(updatedWebsite.rateLimitDelayMs).toBe(500);
  });
});
