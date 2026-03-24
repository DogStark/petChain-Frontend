import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Options } from 'k6/options';
import { Counter, Trend } from 'k6/metrics';
import { config, getApiUrl } from '../config/test-config';

const loginDuration = new Trend('login_duration');
const refreshDuration = new Trend('refresh_duration');
const logoutDuration = new Trend('logout_duration');
const authErrors = new Counter('auth_errors');

export const options: Options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '2m', target: 30 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    login_duration: ['p(95)<300'],
    refresh_duration: ['p(95)<200'],
    logout_duration: ['p(95)<200'],
    auth_errors: ['count<10'],
  },
};

export default function(): void {
  group('Complete Auth Flow', () => {
    const loginStart = Date.now();
    const loginPayload = JSON.stringify({
      email: config.testUsers.petOwner.email,
      password: config.testUsers.petOwner.password,
    });

    const loginResponse = http.post(
      getApiUrl('/auth/login'),
      loginPayload,
      { headers: { 'Content-Type': 'application/json' } }
    );
    
    loginDuration.add(Date.now() - loginStart);
    
    const loginSuccess = check(loginResponse, {
      'login status 200': (r) => r.status === 200 || r.status === 201,
      'has access token': (r) => r.json('accessToken') !== undefined,
      'has refresh token': (r) => r.json('refreshToken') !== undefined,
    });

    if (!loginSuccess) {
      authErrors.add(1);
      return;
    }

    const tokens = loginResponse.json() as any;
    sleep(1);

    const refreshStart = Date.now();
    const refreshPayload = JSON.stringify({
      refreshToken: tokens.refreshToken,
    });

    const refreshResponse = http.post(
      getApiUrl('/auth/refresh'),
      refreshPayload,
      { headers: { 'Content-Type': 'application/json' } }
    );
    
    refreshDuration.add(Date.now() - refreshStart);
    
    check(refreshResponse, {
      'refresh status 200': (r) => r.status === 200 || r.status === 201,
      'new access token received': (r) => r.json('accessToken') !== undefined,
    }) || authErrors.add(1);

    sleep(1);

    const logoutStart = Date.now();
    const logoutResponse = http.post(
      getApiUrl('/auth/logout'),
      null,
      { headers: { 'Authorization': `Bearer ${tokens.accessToken}` } }
    );
    
    logoutDuration.add(Date.now() - logoutStart);
    
    check(logoutResponse, {
      'logout successful': (r) => r.status === 200 || r.status === 201,
    }) || authErrors.add(1);
  });

  sleep(2);
}
