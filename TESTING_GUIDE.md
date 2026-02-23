# 🧪 **Authentication System Testing Guide**

## **How to Verify the Implementation is Correct**

### **1. Code Review Checklist** ✅

**Backend Components:**
- ✅ `AuthService` - Complete with all required methods
- ✅ `AuthController` - All 7 endpoints implemented
- ✅ `JWT Strategy` - Proper token validation
- ✅ `Password Utils` - bcrypt hashing with security
- ✅ `Device Fingerprinting` - Unique device identification
- ✅ `Token Utils` - Secure token generation/validation
- ✅ Database Entities - User, RefreshToken, Session, FailedLoginAttempt

**Frontend Components:**
- ✅ `AuthContext` - Centralized state management
- ✅ Authentication Pages - Login, Register, Reset, Verify
- ✅ `ProtectedRoute` - Route security component
- ✅ Session Management - Enhanced sessions page
- ✅ Navigation - Dynamic auth-aware header

### **2. Manual Testing Steps** 🔍

#### **Step A: Start the Application**
```bash
# 1. Start Backend (NestJS)
cd backend
npm install
npm run start:dev
# Should start on http://localhost:3001

# 2. Start Frontend (Next.js)
cd ../
npm install
npm run dev
# Should start on http://localhost:3000
```

#### **Step B: Test Registration Flow**
1. Navigate to `http://localhost:3000/register`
2. Fill out the form with valid data
3. ✅ **Expected**: Registration success message
4. ✅ **Expected**: Email verification notice

#### **Step C: Test Login Flow**
1. Navigate to `http://localhost:3000/login`
2. Enter registered credentials
3. ✅ **Expected**: Redirect to dashboard
4. ✅ **Expected**: User name appears in header
5. ✅ **Expected**: "Logout" button visible

#### **Step D: Test Protected Routes**
1. While logged in, visit `http://localhost:3000/dashboard`
2. ✅ **Expected**: Dashboard loads with user info
3. Open incognito window, try to access dashboard
4. ✅ **Expected**: Redirect to login page

#### **Step E: Test Session Management**
1. Visit `http://localhost:3000/sessions`
2. ✅ **Expected**: See current session listed
3. Open another browser, log in again
4. ✅ **Expected**: See multiple sessions
5. Try to revoke a session
6. ✅ **Expected**: Session removed from list

#### **Step F: Test Password Reset**
1. Visit `http://localhost:3000/forgot-password`
2. Enter email address
3. ✅ **Expected**: Success message (even if email doesn't exist)

### **3. API Testing with curl** 🌐

#### **Test Registration API**
```bash
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!",
    "firstName": "John",
    "lastName": "Doe"
  }'
```
✅ **Expected**: User object without password field

#### **Test Login API**
```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!"
  }'
```
✅ **Expected**: 
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "abc123...",
  "user": {
    "id": "uuid",
    "email": "test@example.com",
    "firstName": "John",
    "lastName": "Doe"
  }
}
```

#### **Test Token Refresh**
```bash
curl -X POST http://localhost:3001/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "your_refresh_token_here"
  }'
```
✅ **Expected**: New access and refresh tokens

### **4. Security Testing** 🔒

#### **Test Account Lockout**
1. Try logging in with wrong password 5 times
2. ✅ **Expected**: Account locked message
3. Wait 15 minutes or check database

#### **Test Token Expiry**
1. Login and get access token
2. Wait 16 minutes (access token expires in 15)
3. Make authenticated request
4. ✅ **Expected**: 401 Unauthorized
5. Use refresh token
6. ✅ **Expected**: New access token

#### **Test Device Fingerprinting**
1. Login from different browsers
2. Check sessions page
3. ✅ **Expected**: Different device entries

### **5. Database Verification** 💾

Connect to PostgreSQL and verify tables exist:
```sql
-- Check if tables were created
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('users', 'refresh_tokens', 'sessions', 'failed_login_attempts');

-- Check user creation
SELECT id, email, "firstName", "lastName", "emailVerified", "isActive" 
FROM users LIMIT 5;

-- Check sessions
SELECT id, "userId", "deviceFingerprint", "ipAddress", "lastActivityAt"
FROM sessions;

-- Check refresh tokens
SELECT id, "userId", "expiresAt", "replacedBy"
FROM refresh_tokens;
```

### **6. Error Handling Tests** ⚠️

#### **Test Invalid Input**
- Register with weak password ✅ **Expected**: Validation error
- Register with invalid email ✅ **Expected**: Validation error
- Login with non-existent user ✅ **Expected**: Invalid credentials
- Use expired token ✅ **Expected**: Token expired error

#### **Test Malformed Requests**
- Send invalid JSON ✅ **Expected**: 400 Bad Request
- Missing required fields ✅ **Expected**: Validation errors
- Invalid token format ✅ **Expected**: 401 Unauthorized

### **7. Performance Testing** ⚡

#### **Load Testing (Optional)**
```bash
# Install wrk (on Mac: brew install wrk)
# Test login endpoint
wrk -t4 -c10 -d10s -s login-script.lua http://localhost:3001/auth/login
```

### **8. Frontend UI/UX Testing** 🎨

#### **Visual Testing**
1. ✅ Forms have proper validation messages
2. ✅ Loading states show during requests
3. ✅ Success/error states display correctly
4. ✅ Responsive design works on mobile
5. ✅ Navigation updates based on auth state

#### **User Experience Flow**
1. ✅ Registration → Verification notice → Login works
2. ✅ Forgot password → Reset email → Password reset works
3. ✅ Session management is intuitive
4. ✅ Logout works and clears state

### **9. Environment-Specific Testing** 🌍

#### **Development Environment**
- ✅ Hot reload works with auth state
- ✅ Console shows helpful debug info
- ✅ Error boundaries catch auth errors

#### **Production-Ready Checks**
- ✅ Environment variables properly configured
- ✅ JWT secrets are secure (not default)
- ✅ CORS configured correctly
- ✅ Rate limiting in place

### **10. Integration Testing** 🔄

#### **Full User Journey**
```
Register → Verify Email → Login → Use Protected Features → 
Manage Sessions → Reset Password → Login Again → Logout
```

### **Quick Verification Commands** ⚡

```bash
# Check if backend is running
curl http://localhost:3001/auth/login -I

# Check if frontend is running
curl http://localhost:3000 -I

# Test registration endpoint
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"Test123!","firstName":"Test","lastName":"User"}'

# Check authentication state
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"Test123!"}'
```

## **Expected Results Summary** 📋

| Feature | Expected Behavior | Status |
|---------|------------------|---------|
| Registration | Creates user, sends verification email | ✅ |
| Login | Returns JWT tokens, redirects to dashboard | ✅ |
| Logout | Clears tokens, redirects to home | ✅ |
| Token Refresh | Auto-refreshes before expiry | ✅ |
| Password Reset | Sends reset email, allows password change | ✅ |
| Session Management | Shows all devices, allows revocation | ✅ |
| Account Lockout | Locks after 5 failed attempts | ✅ |
| Route Protection | Blocks unauthorized access | ✅ |
| Device Fingerprinting | Tracks unique devices | ✅ |
| Error Handling | Shows user-friendly messages | ✅ |

## **Common Issues & Solutions** 🔧

| Issue | Solution |
|-------|----------|
| "Cannot connect to database" | Start Docker services first |
| "JWT secret not configured" | Set environment variables |
| "CORS error" | Configure backend CORS settings |
| "Token expired" | Implement auto-refresh logic |
| "Registration not working" | Check email service configuration |

---

**🎯 If all these tests pass, the authentication system is working correctly!**