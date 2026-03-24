import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Options } from 'k6/options';
import { Counter, Trend } from 'k6/metrics';
import { config, getApiUrl } from '../config/test-config';
import { login, getAuthHeaders, AuthTokens } from '../utils/auth-helper';

const createPetDuration = new Trend('create_pet_duration');
const updatePetDuration = new Trend('update_pet_duration');
const deletePetDuration = new Trend('delete_pet_duration');
const workflowErrors = new Counter('workflow_errors');

export const options: Options = {
  stages: [
    { duration: '1m', target: 5 },
    { duration: '2m', target: 15 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    create_pet_duration: ['p(95)<600'],
    update_pet_duration: ['p(95)<400'],
    delete_pet_duration: ['p(95)<300'],
    workflow_errors: ['count<5'],
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
    workflowErrors.add(1);
    return;
  }

  const headers = getAuthHeaders(petOwnerAuth.accessToken);
  let petId: string | undefined;

  group('Pet CRUD Workflow', () => {
    const createStart = Date.now();
    const createPayload = JSON.stringify({
      name: `TestPet_${Date.now()}`,
      species: 'dog',
      breed: 'Labrador',
      dateOfBirth: '2020-01-01',
      gender: 'male',
    });

    const createResponse = http.post(
      getApiUrl('/pets'),
      createPayload,
      { headers }
    );
    
    createPetDuration.add(Date.now() - createStart);
    
    const createSuccess = check(createResponse, {
      'pet created': (r) => r.status === 201 || r.status === 200,
      'pet has id': (r) => r.json('id') !== undefined,
    });

    if (!createSuccess) {
      workflowErrors.add(1);
      return;
    }

    petId = createResponse.json('id') as string;
    sleep(1);

    const readResponse = http.get(getApiUrl(`/pets/${petId}`), { headers });
    
    check(readResponse, {
      'pet retrieved': (r) => r.status === 200,
      'pet data correct': (r) => r.json('id') === petId,
    }) || workflowErrors.add(1);

    sleep(1);

    const updateStart = Date.now();
    const updatePayload = JSON.stringify({
      name: `UpdatedPet_${Date.now()}`,
      weight: 25.5,
    });

    const updateResponse = http.patch(
      getApiUrl(`/pets/${petId}`),
      updatePayload,
      { headers }
    );
    
    updatePetDuration.add(Date.now() - updateStart);
    
    check(updateResponse, {
      'pet updated': (r) => r.status === 200,
    }) || workflowErrors.add(1);

    sleep(1);

    const deleteStart = Date.now();
    const deleteResponse = http.del(
      getApiUrl(`/pets/${petId}`),
      null,
      { headers }
    );
    
    deletePetDuration.add(Date.now() - deleteStart);
    
    check(deleteResponse, {
      'pet deleted': (r) => r.status === 200 || r.status === 204,
    }) || workflowErrors.add(1);
  });

  sleep(3);
}
