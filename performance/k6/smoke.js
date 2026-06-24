import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

const frontendLatency = new Trend('frontend_page_duration');
const apiLatency = new Trend('api_request_duration');

const frontendBaseUrl = (__ENV.TARGET_FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
const apiBaseUrl = (__ENV.TARGET_API_URL || '').replace(/\/$/, '');
const routes = ['/', '/offline', '/login', '/search'];

export const options = {
  vus: 5,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    frontend_page_duration: ['p(95)<900'],
    api_request_duration: ['p(95)<700'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'max'],
};

export default function () {
  const route = routes[Math.floor(Math.random() * routes.length)];
  const pageResponse = http.get(`${frontendBaseUrl}${route}`);
  frontendLatency.add(pageResponse.timings.duration);

  check(pageResponse, {
    'frontend route responds with 200': (response) => response.status === 200,
  });

  if (apiBaseUrl) {
    const healthResponse = http.get(`${apiBaseUrl}/observability/health`);
    apiLatency.add(healthResponse.timings.duration);

    check(healthResponse, {
      'backend health responds with 200': (response) => response.status === 200,
    });
  }

  sleep(1);
}