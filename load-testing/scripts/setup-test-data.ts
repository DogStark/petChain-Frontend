import * as http from 'http';
import * as https from 'https';

interface TestUser {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: string;
}

const API_URL = process.env.BASE_URL || 'http://localhost:3000';
const API_PREFIX = process.env.API_PREFIX || 'api/v1';

const testUsers: TestUser[] = [
  {
    email: 'admin@test.com',
    password: 'Test123!@#',
    firstName: 'Admin',
    lastName: 'User',
    role: 'admin',
  },
  {
    email: 'vet@test.com',
    password: 'Test123!@#',
    firstName: 'Vet',
    lastName: 'Owner',
    role: 'vet_owner',
  },
  {
    email: 'owner@test.com',
    password: 'Test123!@#',
    firstName: 'Pet',
    lastName: 'Owner',
    role: 'pet_owner',
  },
];

function makeRequest(
  method: string,
  path: string,
  data?: any,
  token?: string,
): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = `${API_URL}/${API_PREFIX}${path}`;
    const client = url.startsWith('https') ? https : http;
    
    const options: any = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = client.request(url, options, (res) => {
      let body = '';
      
      res.on('data', (chunk) => {
        body += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed });
        } catch {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function createTestUser(user: TestUser): Promise<void> {
  try {
    console.log(`Creating test user: ${user.email}...`);
    
    const response = await makeRequest('POST', '/auth/register', {
      email: user.email,
      password: user.password,
      firstName: user.firstName,
      lastName: user.lastName,
      phoneNumber: '+1234567890',
    });

    if (response.status === 201 || response.status === 200) {
      console.log(`✅ Created: ${user.email}`);
    } else if (response.status === 409) {
      console.log(`ℹ️  Already exists: ${user.email}`);
    } else {
      console.log(`❌ Failed: ${user.email} (${response.status})`);
    }
  } catch (error) {
    console.error(`❌ Error creating ${user.email}:`, error.message);
  }
}

async function setupTestData(): Promise<void> {
  console.log('\n🔧 Setting up test data for load testing...\n');

  for (const user of testUsers) {
    await createTestUser(user);
  }

  console.log('\n✅ Test data setup complete!\n');
  console.log('You can now run load tests with:');
  console.log('  npm run test:load\n');
}

setupTestData();
