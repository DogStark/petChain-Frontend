# PetChain Frontend

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com/DogStark/petChain-Frontend)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15.x-black)](https://nextjs.org/)
[![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

## 📋 Overview
PetChain is a decentralized platform on Stellar that securely manages pet medical records.
Today, health data is often scattered, lost, or stuck in outdated systemsmaking it hard to track vaccinations, manage treatments, or respond quickly in emergencies.

By making records tamper-proof and universally accessible, PetChain keeps vets and pet owners alignedno matter where the pet is or whos treating them.
Pets get a scannable tag for quick access to key medical details. This tag can act as a tracker if pet goes missing.

##  Features
**1. Scannable Pet Tags:** Each pet gets a unique QR code and tag linked to its medical historyinstantly scannable by vets or emergency responders. The tag displays key info and a customizable message from the owner, doubling as a tracker if the pet goes missing.

**2. Always-Available Records:** Medical history is stored on Stellar, ensuring records are tamper-proof, permanent, and accessible anytime.

**3. Controlled Access:** Pet owners control who sees what, share vaccination status publicly or give full access to a vet when needed.

**4. Smart Notifications:** Get automatic alerts for upcoming vaccinations and routine check-ups, so you never miss a date.

**5. Vet-Ready Integration:** Designed to plug into existing vet or hospital software with minimal friction.

**6. Offline Mode**  View essential info even without internet.

**7. Privacy:** Uses advanced cryptography (like ZKPs) to keep sensitive data secure, even on-chain.

##  Tech Stack
* **Frontend:** 
  - Framework: Next.js (React + TypeScript)
  - Styling: Tailwind CSS
  - Hosting: Vercel
* **Backend:** NestJS, AWS, Heroku
* **Database:** PostgreSQL, TypeORM
* **BlockChain:** Rust, StellarJs

##  Getting Started

### Quick Start

```bash
# Clone the repository
git clone https://github.com/DogStark/petChain-Frontend.git
cd petChain-Frontend

# Use the correct Node.js version
nvm use

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Prerequisites

- **Node.js**: v20.19.0 (use nvm: `nvm use`)
- **npm**: v10+ (comes with Node.js)
- **Git**: Latest version

### Detailed Setup

For comprehensive setup instructions, see [**SETUP.md**](./SETUP.md)

### Frontend Development (Next.js)
This repository serves as the main repo for **FRONTEND** contributions to the PetChain project.

### Backend Development (NestJS)
**IMPORTANT:** This repository also contains a `backend/` folder with a complete NestJS API.

**For Backend Contributors:**
- Navigate to `backend/` folder
- See `backend/HIGH_QUALITY_ISSUES.md` for 17 open NestJS development issues
- Follow `backend/README.md` for setup instructions
- Requires PostgreSQL, Redis, and Docker

**Note:** Please distinguish between:
- **Frontend issues:** Next.js/React (root folder)
- **Backend issues:** NestJS/API (backend/ folder)

##  Contributing 

### Code Quality

This project maintains high code quality standards:
- ✅ TypeScript strict mode
- ✅ ESLint with Next.js rules
- ✅ Prettier formatting
- ✅ Pre-commit hooks with Husky
- ✅ Automated build verification

**Before contributing**, please read:
- [**Setup Guide**](./SETUP.md) - Development environment setup
- [**Code Style Guide**](./CODE_STYLE.md) - Coding standards and best practices
- [**Contribution Guide**](./contributing.md) - How to contribute
- [**Project Status**](./PROJECT_STATUS.md) - Current project status

### Frontend Contributions (Next.js)
For frontend development, read our [**Contribution Guide**](./contributing.md)

### Backend Contributions (NestJS)
**NEW:** We have 17 high-quality backend issues available!
- Check `backend/HIGH_QUALITY_ISSUES.md` for detailed NestJS development tasks
- Issues include authentication, medical records, Stellar integration, and more
- Each issue has clear acceptance criteria and technical specifications

**Important:** Make sure you're working on the correct technology:
- **Frontend:** Next.js issues (root folder)
- **Backend:** NestJS issues (backend/ folder)

##  Related Repositories
To work on other parts of the project, you can find the related repositories below:
* Backend – [GitHub Link](https://github.com/DogStark/petchain_api)
* Smart Contracts – [GitHub Link](https://github.com/DogStark/PetMedTracka-Contracts)
* Mobile App – [GitHub Link](https://github.com/DogStark/PetMedTracka-MobileApp)

##  Documentation

- [Setup Guide](./SETUP.md) - Complete development setup instructions
- [Code Style Guide](./CODE_STYLE.md) - Coding standards and best practices
- [Project Status](./PROJECT_STATUS.md) - Current build status and progress
- [Build Verification](./BUILD_VERIFICATION.md) - Build verification details
- [Contributing Guide](./contributing.md) - How to contribute to the project

##  Scripts

### Development
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
```

### Code Quality
```bash
npm run lint         # Run ESLint
npm run format       # Format code with Prettier
npm run type-check   # Run TypeScript type checking
npm run validate     # Run all checks
```

### Maintenance
```bash
npm run clean        # Clean build artifacts
npm run audit:fix    # Fix security vulnerabilities
./verify-build.sh    # Verify entire project builds
```


##  Contact & Support
For feedback, questions or collaboration:

* Contact project lead: [@llins_x](https://t.me/llins_x)
* Join Community Chat: [@PetChain Telegram Group](https://t.me/+Jw8HkvUhinw2YjE0) 
*  Report Issues: Submit bug reports or feature requests via [GitHub Issues](https://github.com/DogStark/PetMedTracka-Contracts/issues).

 Star our [GitHub Repository](https://github.com/DogStark/pet-medical-tracka) to stay updated on new features and releases.

##  License
PetChain is licensed under the MIT License.
