import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as tls from 'tls';
import * as url from 'url';

export interface ValidationResult {
  isReachable: boolean;
  statusCode?: number;
  isHttps: boolean;
  sslValid: boolean;
  sslExpiryDate?: Date;
  redirectChain: string[];
  finalUrl?: string;
  errorMessage?: string;
}

@Injectable()
export class ValidatorService {
  private readonly logger = new Logger(ValidatorService.name);

  /**
   * Validates a domain for reachability, HTTPS support, SSL certificate health, and redirect behavior.
   * Module 1 Requirement: If unreachable, return error.
   */
  async validateWebsite(targetDomainOrUrl: string): Promise<ValidationResult> {
    this.logger.log(`Starting website validation for: ${targetDomainOrUrl}`);

    let formattedUrl = targetDomainOrUrl.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    const parsedUrl = url.parse(formattedUrl);
    const hostname = parsedUrl.hostname || targetDomainOrUrl;

    const result: ValidationResult = {
      isReachable: false,
      isHttps: formattedUrl.startsWith('https://'),
      sslValid: false,
      redirectChain: [],
    };

    // 1. Check SSL Certificate health if HTTPS
    if (result.isHttps && hostname) {
      try {
        const sslInfo = await this.checkSslCertificate(hostname, parsedUrl.port ? parseInt(parsedUrl.port, 10) : 443);
        result.sslValid = sslInfo.valid;
        result.sslExpiryDate = sslInfo.expiryDate;
      } catch (sslErr) {
        this.logger.warn(`SSL check failed for ${hostname}`, sslErr);
        result.sslValid = false;
      }
    }

    // 2. Check Reachability and Redirect Chain
    try {
      const redirectChain: string[] = [formattedUrl];
      const response = await axios.get(formattedUrl, {
        timeout: 10000,
        maxRedirects: 10,
        validateStatus: () => true, // Accept any status code to inspect reachability
        headers: {
          'User-Agent': process.env.USER_AGENT || 'GrowthX-AI-Bot/1.0 (+https://growthx.ai/bot)',
        },
      });

      const finalUrl = response.request?.res?.responseUrl || formattedUrl;
      if (finalUrl !== formattedUrl && !redirectChain.includes(finalUrl)) {
        redirectChain.push(finalUrl);
      }
      result.isReachable = response.status >= 200 && response.status < 500;
      result.statusCode = response.status;
      result.redirectChain = redirectChain;
      result.finalUrl = finalUrl;

      if (!result.isReachable) {
        result.errorMessage = `Website returned HTTP status code ${response.status}. Considered unreachable for crawling.`;
      }

      this.logger.log(`Validation completed for ${hostname}: Reachable=${result.isReachable}, Status=${result.statusCode}, SSL=${result.sslValid}`);
    } catch (httpErr: any) {
      this.logger.error(`Website unreachable: ${formattedUrl}`, httpErr.message);
      result.isReachable = false;
      result.errorMessage = `Website unreachable: ${httpErr.message || 'Connection timeout or network failure.'}`;
    }

    return result;
  }

  /**
   * Inspects SSL/TLS certificate via raw socket connection
   */
  private checkSslCertificate(hostname: string, port: number = 443): Promise<{ valid: boolean; expiryDate?: Date }> {
    return new Promise((resolve, reject) => {
      const socket = tls.connect(port, hostname, { servername: hostname, rejectUnauthorized: false }, () => {
        try {
          const cert = socket.getPeerCertificate();
          if (!cert || !cert.valid_to) {
            socket.end();
            return resolve({ valid: false });
          }

          const expiryDate = new Date(cert.valid_to);
          const now = new Date();
          const valid = socket.authorized && expiryDate > now;

          socket.end();
          resolve({ valid, expiryDate });
        } catch (err) {
          socket.end();
          reject(err);
        }
      });

      socket.on('error', (err) => {
        reject(err);
      });

      socket.setTimeout(5000, () => {
        socket.destroy();
        reject(new Error('SSL check socket timed out'));
      });
    });
  }
}
