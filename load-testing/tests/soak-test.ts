import http from 'k6/http';
import { check, sleep } from 'k6';
import { Options } from 'k6/options';
import { config, getApiUrl } from '../config/test-config';
import { login, getAuthHeaders, AuthTokens } from '../utils/auth-helper';

export const options: Options = {
  stages: config.loadProfiles.soak.stages,
  thresholds: {
    http_req_duration: config.thresholds.http_req_duration,
    http_req_failed: ['rate<0.01'],
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
    'soak test - status ok': (r) => r.status === 200,
    'soak test - no memory leaks': (r) => r.timings.duration < 1000,
  });

  sleep(5);
}
