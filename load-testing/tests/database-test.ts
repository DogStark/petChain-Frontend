import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Options } from 'k6/options';
import { Counter, Trend } from 'k6/metrics';
import { config, getApiUrl } from '../config/test-config';
import { login, getAuthHeaders, AuthTokens } from '../utils/auth-helper';

const dbQueryDuration = new Trend('db_query_duration');
const dbErrors = new Counter('db_errors');

export const options: Options = {
  stages: [
    { duration: '1m', target: 30 },
    { duration: '3m', target: 30 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    db_query_duration: ['p(95)<400'],
    db_errors: ['count<5'],
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
    dbErrors.add(1);
    return;
  }

  const headers = getAuthHeaders(petOwnerAuth.accessToken);

  group('Database-Heavy Operations', () => {
    // Complex query with joins
    const start1 = Date.now();
    const response1 = http.get(
      getApiUrl('/pets?include=vaccinations,medicalRecords'),
      { headers }
    );
    dbQueryDuration.add(Date.now() - start1);
    
    check(response1, {
      'complex query successful': (r) => r.status === 200,
    }) || dbErrors.add(1);

    sleep(1);

    // Search query
    const start2 = Date.now();
    const response2 = http.get(
      getApiUrl('/search?q=labrador&type=breed'),
      { headers }
    );
    dbQueryDuration.add(Date.now() - start2);
    
    check(response2, {
      'search query successful': (r) => r.status === 200,
    }) || dbErrors.add(1);

    sleep(1);

    // Aggregation query
    const start3 = Date.now();
    const response3 = http.get(
      getApiUrl('/analytics/pet-statistics'),
      { headers }
    );
    dbQueryDuration.add(Date.now() - start3);
    
    check(response3, {
      'aggregation query successful': (r) => r.status === 200 || r.status === 404,
    }) || dbErrors.add(1);
  });

  sleep(2);
}
