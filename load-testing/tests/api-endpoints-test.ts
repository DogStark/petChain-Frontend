import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Options } from 'k6/options';
import { Counter, Trend } from 'k6/metrics';
import { config, getApiUrl } from '../config/test-config';
import { login, getAuthHeaders, AuthTokens } from '../utils/auth-helper';

const authDuration = new Trend('auth_duration');
const petsDuration = new Trend('pets_duration');
const searchDuration = new Trend('search_duration');
const errorCount = new Counter('errors');

export const options: Options = {
  stages: [
    { duration: '1m', target: 20 },
    { duration: '3m', target: 20 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_duration: config.thresholds.http_req_duration,
    http_req_failed: config.thresholds.http_req_failed,
    auth_duration: config.thresholds.auth_duration,
    pets_duration: config.thresholds.api_duration,
    search_duration: config.thresholds.search_duration,
  },
};

interface SetupData {
  petOwnerAuth: AuthTokens | null;
}

export function setup(): SetupData {
  const petOwnerAuth = login(
    config.testUsers.petOwner.email,
    config.testUsers.petOwner.password
  );
  
  return { petOwnerAuth };
}

export default function(data: SetupData): void {
  const { petOwnerAuth } = data;
  
  if (!petOwnerAuth) {
    errorCount.add(1);
    return;
  }

  const headers = getAuthHeaders(petOwnerAuth.accessToken);

  group('Authentication', () => {
    const start = Date.now();
    const response = http.get(getApiUrl('/auth/profile'), { headers });
    authDuration.add(Date.now() - start);
    
    check(response, {
      'auth profile status 200': (r) => r.status === 200,
    }) || errorCount.add(1);
  });

  sleep(1);

  group('Pets', () => {
    const start = Date.now();
    const response = http.get(getApiUrl('/pets'), { headers });
    petsDuration.add(Date.now() - start);
    
    check(response, {
      'pets list status 200': (r) => r.status === 200,
      'pets response time ok': (r) => r.timings.duration < 500,
    }) || errorCount.add(1);
  });

  sleep(1);

  group('Search', () => {
    const start = Date.now();
    const response = http.get(getApiUrl('/search?q=dog&type=pet'), { headers });
    searchDuration.add(Date.now() - start);
    
    check(response, {
      'search status ok': (r) => r.status === 200 || r.status === 404,
      'search response time ok': (r) => r.timings.duration < 800,
    }) || errorCount.add(1);
  });

  sleep(1);

  group('Vaccinations', () => {
    const response = http.get(getApiUrl('/vaccinations'), { headers });
    
    check(response, {
      'vaccinations status ok': (r) => r.status === 200,
    }) || errorCount.add(1);
  });

  sleep(1);

  group('Medical Records', () => {
    const response = http.get(getApiUrl('/medical-records'), { headers });
    
    check(response, {
      'medical records status ok': (r) => r.status === 200,
    }) || errorCount.add(1);
  });

  sleep(2);
}
