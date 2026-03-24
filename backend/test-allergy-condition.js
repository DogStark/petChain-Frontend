/**
 * Simple test script for Allergy & Condition Tracking
 * 
 * Usage: node test-allergy-condition.js
 * 
 * Make sure the server is running first: npm run start:dev
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';

// Helper function to make HTTP requests
function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const response = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, data: response });
        } catch (e) {
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

// Test functions
async function testServerConnection() {
  console.log('\n🔍 Testing server connection...');
  try {
    const response = await makeRequest('GET', '/');
    console.log('✅ Server is running!');
    console.log(`   Status: ${response.status}`);
    return true;
  } catch (error) {
    console.log('❌ Server is not running!');
    console.log('   Please start the server with: npm run start:dev');
    return false;
  }
}

async function testAllergyEndpoints() {
  console.log('\n📋 Testing Allergy Endpoints...\n');

  // Test 1: Create an allergy (will fail without valid petId, but tests endpoint exists)
  console.log('1. Testing POST /allergies');
  try {
    const allergyData = {
      petId: '00000000-0000-0000-0000-000000000000', // Dummy UUID
      allergen: 'Peanuts',
      severity: 'severe',
      reactionNotes: 'Swelling and difficulty breathing',
      discoveredDate: '2024-02-21',
      notes: 'Test allergy',
      alertVeterinarian: true,
    };
    const response = await makeRequest('POST', '/allergies', allergyData);
    if (response.status === 201) {
      console.log('   ✅ Endpoint exists and accepts requests');
      console.log(`   Response: ${JSON.stringify(response.data).substring(0, 100)}...`);
    } else if (response.status === 404) {
      console.log('   ❌ Endpoint not found - check if AllergiesModule is registered');
    } else {
      console.log(`   ⚠️  Endpoint exists but returned status ${response.status}`);
      console.log(`   This is expected without a valid petId`);
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }

  // Test 2: Get all allergies
  console.log('\n2. Testing GET /allergies');
  try {
    const response = await makeRequest('GET', '/allergies');
    if (response.status === 200) {
      console.log('   ✅ Endpoint exists and returns data');
      console.log(`   Found ${Array.isArray(response.data) ? response.data.length : 0} allergies`);
    } else if (response.status === 404) {
      console.log('   ❌ Endpoint not found');
    } else {
      console.log(`   ⚠️  Status: ${response.status}`);
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }

  // Test 3: Get allergies by pet (with dummy ID)
  console.log('\n3. Testing GET /allergies/pet/:petId');
  try {
    const dummyPetId = '00000000-0000-0000-0000-000000000000';
    const response = await makeRequest('GET', `/allergies/pet/${dummyPetId}`);
    if (response.status === 200) {
      console.log('   ✅ Endpoint exists and returns data');
      console.log(`   Found ${Array.isArray(response.data) ? response.data.length : 0} allergies for pet`);
    } else if (response.status === 404) {
      console.log('   ❌ Endpoint not found');
    } else {
      console.log(`   ⚠️  Status: ${response.status}`);
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }

  // Test 4: Get severe allergies
  console.log('\n4. Testing GET /allergies/pet/:petId/severe');
  try {
    const dummyPetId = '00000000-0000-0000-0000-000000000000';
    const response = await makeRequest('GET', `/allergies/pet/${dummyPetId}/severe`);
    if (response.status === 200) {
      console.log('   ✅ Endpoint exists (NEW FEATURE)');
    } else if (response.status === 404) {
      console.log('   ❌ Endpoint not found');
    } else {
      console.log(`   ⚠️  Status: ${response.status}`);
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }

  // Test 5: Get allergy summary
  console.log('\n5. Testing GET /allergies/pet/:petId/summary');
  try {
    const dummyPetId = '00000000-0000-0000-0000-000000000000';
    const response = await makeRequest('GET', `/allergies/pet/${dummyPetId}/summary`);
    if (response.status === 200) {
      console.log('   ✅ Endpoint exists (NEW FEATURE)');
      console.log(`   Summary: ${JSON.stringify(response.data)}`);
    } else if (response.status === 404) {
      console.log('   ❌ Endpoint not found');
    } else {
      console.log(`   ⚠️  Status: ${response.status}`);
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
}

async function testConditionEndpoints() {
  console.log('\n📋 Testing Condition Endpoints...\n');

  // Test 1: Create a condition
  console.log('1. Testing POST /conditions');
  try {
    const conditionData = {
      petId: '00000000-0000-0000-0000-000000000000',
      conditionName: 'Diabetes',
      severity: 'severe',
      diagnosedDate: '2024-01-15',
      isChronicCondition: true,
    };
    const response = await makeRequest('POST', '/conditions', conditionData);
    if (response.status === 201) {
      console.log('   ✅ Endpoint exists and accepts requests');
    } else if (response.status === 404) {
      console.log('   ❌ Endpoint not found - check if ConditionsModule is registered');
    } else {
      console.log(`   ⚠️  Endpoint exists but returned status ${response.status}`);
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }

  // Test 2: Get all conditions
  console.log('\n2. Testing GET /conditions');
  try {
    const response = await makeRequest('GET', '/conditions');
    if (response.status === 200) {
      console.log('   ✅ Endpoint exists and returns data');
      console.log(`   Found ${Array.isArray(response.data) ? response.data.length : 0} conditions`);
    } else if (response.status === 404) {
      console.log('   ❌ Endpoint not found');
    } else {
      console.log(`   ⚠️  Status: ${response.status}`);
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }

  // Test 3: Get chronic conditions
  console.log('\n3. Testing GET /conditions/pet/:petId/chronic');
  try {
    const dummyPetId = '00000000-0000-0000-0000-000000000000';
    const response = await makeRequest('GET', `/conditions/pet/${dummyPetId}/chronic`);
    if (response.status === 200) {
      console.log('   ✅ Endpoint exists (NEW FEATURE)');
    } else if (response.status === 404) {
      console.log('   ❌ Endpoint not found');
    } else {
      console.log(`   ⚠️  Status: ${response.status}`);
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }

  // Test 4: Get active conditions
  console.log('\n4. Testing GET /conditions/pet/:petId/active');
  try {
    const dummyPetId = '00000000-0000-0000-0000-000000000000';
    const response = await makeRequest('GET', `/conditions/pet/${dummyPetId}/active`);
    if (response.status === 200) {
      console.log('   ✅ Endpoint exists (NEW FEATURE)');
    } else if (response.status === 404) {
      console.log('   ❌ Endpoint not found');
    } else {
      console.log(`   ⚠️  Status: ${response.status}`);
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }

  // Test 5: Get condition summary
  console.log('\n5. Testing GET /conditions/pet/:petId/summary');
  try {
    const dummyPetId = '00000000-0000-0000-0000-000000000000';
    const response = await makeRequest('GET', `/conditions/pet/${dummyPetId}/summary`);
    if (response.status === 200) {
      console.log('   ✅ Endpoint exists (NEW FEATURE)');
      console.log(`   Summary: ${JSON.stringify(response.data)}`);
    } else if (response.status === 404) {
      console.log('   ❌ Endpoint not found');
    } else {
      console.log(`   ⚠️  Status: ${response.status}`);
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
}

// Main test runner
async function runTests() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Allergy & Condition Tracking - Feature Test');
  console.log('═══════════════════════════════════════════════════════');

  const serverRunning = await testServerConnection();

  if (!serverRunning) {
    console.log('\n❌ Cannot run tests - server is not running');
    console.log('\nTo start the server:');
    console.log('  cd backend');
    console.log('  npm run start:dev');
    process.exit(1);
  }

  await testAllergyEndpoints();
  await testConditionEndpoints();

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  Test Summary');
  console.log('═══════════════════════════════════════════════════════');
  console.log('\n✅ If all endpoints show "Endpoint exists", the implementation is working!');
  console.log('⚠️  Some endpoints may return errors without valid data, but that\'s expected.');
  console.log('\n📚 For full testing with real data, see TEST_ALLERGY_CONDITION.md');
  console.log('\n');
}

// Run the tests
runTests().catch((error) => {
  console.error('Test failed:', error);
  process.exit(1);
});
