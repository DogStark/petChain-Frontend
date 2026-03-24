import http from 'k6/http';
import { check, sleep } from 'k6';
import { Options } from 'k6/options';
import { config, getApiUrl } from '../config/test-config';
import { login, getAuthHeaders, AuthTokens } from '../utils/auth-helper';

export const options: Options = {
  stages: config.loadProfiles.load.stages,
  thresholds: {
    http_req_duration: config.thresholds.http_req_duration,
    http_req_failed: config.thresholds.http_req_failed,
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
    console.error('Authentication failed in setup');
    return;
  }

  // Test 1: Get user profile
  let response = http.get(
    getApiUrl('/users/profile'),
    { headers: getAuthHeaders(petOwnerAuth.accessToken) }
  );
  
  check(response, {
    'profile retrieved': (r) => r.status === 200,
    'profile has data': (r) => r.json('id') !== undefined,
  });
  
  sleep(1);

  // Test 2: List pets
  response = http.get(
    getApiUrl('/pets'),
    { headers: getAuthHeaders(petOwnerAuth.accessToken) }
  );
  
  check(response, {
    'pets list retrieved': (r) => r.status === 200,
    'pets is array': (r) => Array.isArray(r.json()),
  });
  
  sleep(1);

  // Test 3: Search breeds
  response = http.get(
    getApiUrl('/breeds?search=labrador'),
    { headers: getAuthHeaders(petOwnerAuth.accessToken) }
  );
  
  check(response, {
    'breeds search successful': (r) => r.status === 200,
  });
  
  sleep(1);

  // Test 4: Get vaccinations
  response = http.get(
    getApiUrl('/vaccinations'),
    { headers: getAuthHeaders(petOwnerAuth.accessToken) }
  );
  
  check(response, {
    'vaccinations retrieved': (r) => r.status === 200,
  });
  
  sleep(2);
}

export function teardown(data: SetupData): void {
  console.log('Load test completed');
}
