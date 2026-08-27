# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take security vulnerabilities seriously. Please follow these steps:

### 🔒 Private Disclosure

**DO NOT** create a public GitHub issue for security vulnerabilities.

Instead, please:

1. **Email**: Send details to security@petchain.com
2. **Telegram**: Contact [@llins_x](https://t.me/llins_x) privately
3. **Include**:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### 📋 What to Include

- **Component**: Frontend, Backend, or Smart Contracts
- **Severity**: Critical, High, Medium, Low
- **Attack Vector**: Network, Local, Physical
- **Proof of Concept**: Code or screenshots

### ⏱️ Response Timeline

- **Acknowledgment**: Within 24 hours
- **Initial Assessment**: Within 72 hours  
- **Status Updates**: Weekly until resolved
- **Fix Timeline**: Based on severity
  - Critical: 1-7 days
  - High: 7-30 days
  - Medium: 30-90 days
  - Low: 90+ days

### 🏆 Recognition

We appreciate security researchers and will:
- Credit you in our security advisories (if desired)
- Add you to our Hall of Fame
- Consider bug bounties for significant findings

### 🛡️ Security Best Practices

**For Contributors:**
- Never commit secrets or API keys
- Use environment variables for sensitive data
- Follow OWASP security guidelines
- Keep dependencies updated
- Use TypeScript strict mode
- Validate all inputs
- Implement proper authentication
- Use HTTPS in production

**For Users:**
- Keep your software updated
- Use strong passwords
- Enable two-factor authentication
- Don't share private keys
- Verify QR codes before scanning

Thank you for helping keep PetChain secure! 🔐