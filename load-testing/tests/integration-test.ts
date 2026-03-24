import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Options } from 'k6/options';
import { Counter, Trend, Rate } from 'k6/metrics';
import { config, getApiUrl } from '../config/test-config';
import { login, getAuthHeaders, AuthTokens } from '../utils/auth-helper';

// Custom metrics
const scenarioDuration = new Trend('scenario_duration');
const scenarioErrors = new Counter('scenario_errors');
const scenarioSuccess = new Rate('scenario_success');

export const options: Options = {
  stages: [
    { duration: '2m', target: 15 },
    { duration: '5m', target: 15 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    scenario_duration: ['p(95)<2000'],
    scenario_errors: ['count<10'],
    scenario_success: ['rate>0.95'],
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
    scenarioErrors.add(1);
    scenarioSuccess.add(0);
    return;
  }

  const headers = getAuthHeaders(petOwnerAuth.accessToken);
  const scenarioStart = Date.now();
  let success = true;

  // Realistic user journey
  group('User Journey: Pet Owner Daily Check', () => {
    // 1. Check profile
    let response = http.get(getApiUrl('/users/profile'), { headers });
    if (!check(response, { 'profile loaded': (r) => r.status === 200 })) {
      success = false;
      scenarioErrors.add(1);
    }
    sleep(1);

    // 2. View pets
    response = http.get(getApiUrl('/pets'), { headers });
    if (!check(response, { 'pets loaded': (r) => r.status === 200 })) {
      success = false;
      scenarioErrors.add(1);
    }
    
    const pets = response.json() as any[];
    if (pets && pets.length > 0) {
      const petId = pets[0].id;
      sleep(1);

      // 3. View pet details
      response = http.get(getApiUrl(`/pets/${petId}`), { headers });
      if (!check(response, { 'pet details loaded': (r) => r.status === 200 })) {
        success = false;
        scenarioErrors.add(1);
      }
      sleep(1);

      // 4. Check vaccinations
      response = http.get(getApiUrl(`/vaccinations?petId=${petId}`), { headers });
      if (!check(response, { 'vaccinations loaded': (r) => r.status === 200 })) {
        success = false;
        scenarioErrors.add(1);
      }
      sleep(1);

      // 5. Check medical records
      response = http.get(getApiUrl(`/medical-records?petId=${petId}`), { headers });
      if (!check(response, { 'medical records loaded': (r) => r.status === 200 })) {
        success = false;
        scenarioErrors.add(1);
      }
    }

    sleep(2);

    // 6. Search for vet clinics
    response = http.get(getApiUrl('/vet-clinics?limit=10'), { headers });
    if (!check(response, { 'vet clinics loaded': (r) => r.status === 200 })) {
      success = false;
      scenarioErrors.add(1);
    }
  });

  scenarioDuration.add(Date.now() - scenarioStart);
  scenarioSuccess.add(success ? 1 : 0);

  sleep(3);
}

export function teardown(data: SetupData): void {
  console.log('Integration test completed');
}
