import http from 'k6/http';
import { check, sleep } from 'k6';
import { Options } from 'k6/options';
import { config, getApiUrl } from '../config/test-config';
import { login, getAuthHeaders, AuthTokens } from '../utils/auth-helper';

export const options: Options = {
  stages: config.loadProfiles.stress.stages,
  thresholds: {
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],
    http_req_failed: ['rate<0.05'],
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

  const batch = http.batch([
    ['GET', getApiUrl('/users/profile'), null, { headers }],
    ['GET', getApiUrl('/pets'), null, { headers }],
    ['GET', getApiUrl('/vaccinations'), null, { headers }],
    ['GET', getApiUrl('/breeds?limit=50'), null, { headers }],
    ['GET', getApiUrl('/medical-records'), null, { headers }],
  ]);

  batch.forEach((response, index) => {
    check(response, {
      [`request ${index} status ok`]: (r) => r.status === 200 || r.status === 404,
    });
  });

  sleep(0.5);
}
