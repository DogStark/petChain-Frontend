// Load Testing Configuration
export interface TestUser {
  email: string;
  password: string;
}

export interface LoadProfile {
  vus?: number;
  duration?: string;
  stages?: Array<{ duration: string; target: number }>;
}

export interface Config {
  baseUrl: string;
  apiPrefix: string;
  testUsers: {
    admin: TestUser;
    vetOwner: TestUser;
    petOwner: TestUser;
  };
  thresholds: {
    http_req_duration: string[];
    http_req_failed: string[];
    auth_duration: string[];
    api_duration: string[];
    search_duration: string[];
    upload_duration: string[];
  };
  loadProfiles: {
    smoke: LoadProfile;
    load: LoadProfile;
    stress: LoadProfile;
    spike: LoadProfile;
    soak: LoadProfile;
  };
}

export const config: Config = {
  baseUrl: __ENV.BASE_URL || 'http://localhost:3000',
  apiPrefix: __ENV.API_PREFIX || 'api/v1',
  
  testUsers: {
    admin: {
      email: __ENV.ADMIN_EMAIL || 'admin@test.com',
      password: __ENV.ADMIN_PASSWORD || 'Test123!@#',
    },
    vetOwner: {
      email: __ENV.VET_OWNER_EMAIL || 'vet@test.com',
      password: __ENV.VET_OWNER_PASSWORD || 'Test123!@#',
    },
    petOwner: {
      email: __ENV.PET_OWNER_EMAIL || 'owner@test.com',
      password: __ENV.PET_OWNER_PASSWORD || 'Test123!@#',
    },
  },
  
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
    auth_duration: ['p(95)<300'],
    api_duration: ['p(95)<500'],
    search_duration: ['p(95)<800'],
    upload_duration: ['p(95)<2000'],
  },
  
  loadProfiles: {
    smoke: {
      vus: 1,
      duration: '1m',
    },
    load: {
      stages: [
        { duration: '2m', target: 10 },
        { duration: '5m', target: 10 },
        { duration: '2m', target: 0 },
      ],
    },
    stress: {
      stages: [
        { duration: '2m', target: 10 },
        { duration: '5m', target: 50 },
        { duration: '2m', target: 100 },
        { duration: '5m', target: 100 },
        { duration: '2m', target: 0 },
      ],
    },
    spike: {
      stages: [
        { duration: '10s', target: 10 },
        { duration: '1m', target: 200 },
        { duration: '10s', target: 10 },
        { duration: '3m', target: 10 },
        { duration: '10s', target: 0 },
      ],
    },
    soak: {
      stages: [
        { duration: '2m', target: 20 },
        { duration: '3h', target: 20 },
        { duration: '2m', target: 0 },
      ],
    },
  },
};

export function getApiUrl(path: string): string {
  return `${config.baseUrl}/${config.apiPrefix}${path}`;
}
