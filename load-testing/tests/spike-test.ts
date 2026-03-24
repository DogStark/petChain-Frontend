import http from 'k6/http';
import { check, sleep } from 'k6';
import { Options } from 'k6/options';
import { config, getApiUrl } from '../config/test-config';
import { login, getAuthHeaders, AuthTokens } from '../utils/auth-helper';

export const options: Options = {
  stages: config.loadProfiles.spike.stages,
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.1'],
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
    return;
  }

  const headers = getAuthHeaders(petOwnerAuth.accessToken);

  const response = http.get(getApiUrl('/pets'), { headers });
  
  check(response, {
    'spike test - status ok': (r) => r.status === 200 || r.status === 503,
    'spike test - response time acceptable': (r) => r.timings.duration < 3000,
  });

  sleep(0.1);
}
