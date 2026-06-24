import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend } from 'k6/metrics';

const frontendLatency = new Trend('frontend_page_duration');
const apiLatency = new Trend('api_request_duration');

const frontendBaseUrl = (__ENV.TARGET_FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
const apiBaseUrl = (__ENV.TARGET_API_URL || '').replace(/\/$/, '');
const pageRoutes = ['/', '/offline', '/login', '/search', '/sessions'];

export const options = {
  scenarios: {
    frontend_browse: {
      executor: 'ramping-arrival-rate',
      exec: 'frontendScenario',
      startRate: 5,
      timeUnit: '1s',
      preAllocatedVUs: 20,
      maxVUs: 80,
      stages: [
        { target: 10, duration: '1m' },
        { target: 25, duration: '2m' },
        { target: 40, duration: '2m' },
        { target: 0, duration: '30s' },
      ],
    },
    api_probe: {
      executor: 'constant-vus',
      exec: 'apiScenario',
      vus: 8,
      duration: '4m',
      startTime: '15s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.02'],
    frontend_page_duration: ['p(95)<1400'],
    api_request_duration: ['p(95)<900'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

export function frontendScenario() {
  const route = pageRoutes[Math.floor(Math.random() * pageRoutes.length)];

  group('frontend browsing', () => {
    const pageResponse = http.get(`${frontendBaseUrl}${route}`);
    frontendLatency.add(pageResponse.timings.duration);

    check(pageResponse, {
      'frontend page responds with 200': (response) => response.status === 200,
    });
  });

  sleep(Math.random() * 2);
}

export function apiScenario() {
  if (!apiBaseUrl) {
    sleep(1);
    return;
  }

  group('backend observability probes', () => {
    const healthResponse = http.get(`${apiBaseUrl}/observability/health`);
    apiLatency.add(healthResponse.timings.duration);
    check(healthResponse, {
      'health endpoint responds with 200': (response) => response.status === 200,
    });

    const metricsResponse = http.get(`${apiBaseUrl}/observability/metrics`);
    apiLatency.add(metricsResponse.timings.duration);
    check(metricsResponse, {
      'metrics endpoint responds with 200': (response) => response.status === 200,
    });

    const performanceResponse = http.get(`${apiBaseUrl}/observability/performance`);
    apiLatency.add(performanceResponse.timings.duration);
    check(performanceResponse, {
      'performance endpoint responds with 200': (response) => response.status === 200,
    });
  });

  sleep(1);
}