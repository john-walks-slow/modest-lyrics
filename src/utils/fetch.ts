import fetch, { RequestInfo, RequestInit } from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';

// --- Custom Fetch Implementation ---
export const customFetch = ((url: URL | RequestInfo, options: RequestInit | undefined) => {
  // Get proxy from environment variables
  const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;

  if (proxy) {
    const agent = new HttpsProxyAgent(proxy, {
      // Allow unsafe TLS connections
      rejectUnauthorized: false,
    });

    return fetch(url, {
      ...options,
      agent,
    });
  }

  // If no proxy is set, use the default fetch with unsafe TLS option if needed for other requests.
  // Note: For Google's domains, this is generally not required,
  // but is included here for completeness of the "allow unsafe tls" requirement.
  const https = require('https');
  const agent = new https.Agent({
    rejectUnauthorized: false,
  });

  return fetch(url, {
    ...options,
    agent,
  });
}) as unknown as typeof globalThis.fetch;