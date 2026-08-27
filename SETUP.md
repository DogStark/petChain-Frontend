# Development Setup Guide

## Prerequisites

- **Node.js**: v20.19.0 (use nvm: `nvm use`)
- **npm**: v10+ (comes with Node.js)
- **Git**: Latest version

## Quick Start

### Frontend Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/DogStark/petChain-Frontend.git
   cd petChain-Frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

4. **Run development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

### Backend Setup

1. **Navigate to backend folder**
   ```bash
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Run development server**
   ```bash
   npm run start:dev
   ```

## Available Scripts

### Frontend Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint errors
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting
- `npm run type-check` - Run TypeScript type checking
- `npm run validate` - Run all checks (type-check, lint, format)
- `npm run clean` - Clean build artifacts
- `npm run clean:all` - Clean everything including node_modules
- `npm run audit:fix` - Fix security vulnerabilities

### Backend Scripts

- `npm run start:dev` - Start development server with watch mode
- `npm run build` - Build for production
- `npm run start:prod` - Start production server
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm run test` - Run unit tests
- `npm run test:e2e` - Run end-to-end tests
- `npm run test:cov` - Run tests with coverage

## Code Quality

### Pre-commit Hooks

This project uses Husky and lint-staged to run checks before commits:
- Prettier formatting
- ESLint linting
- TypeScript type checking

### Manual Validation

Before pushing, run:
```bash
npm run validate
```

## Project Structure

```
petChain-Frontend/
├── src/
│   ├── components/     # React components
│   ├── pages/          # Next.js pages
│   └── styles/         # Global styles
├── public/             # Static assets
├── backend/            # NestJS backend (separate)
├── .github/            # GitHub workflows and templates
└── ...config files
```

## Environment Variables

### Frontend (.env.local)

```env
NEXT_PUBLIC_APP_NAME=PetChain
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
```

### Backend (.env)

See `backend/README.md` for backend-specific environment variables.

## Troubleshooting

### Port Already in Use

If port 3000 is already in use:
```bash
# Kill the process using port 3000
lsof -ti:3000 | xargs kill -9

# Or use a different port
PORT=3001 npm run dev
```

### Node Version Issues

Make sure you're using the correct Node.js version:
```bash
nvm use
```

### Clean Install

If you encounter dependency issues:
```bash
npm run clean:all
npm install
```

### Build Errors

1. Clean the build cache:
   ```bash
   npm run clean
   ```

2. Run type checking:
   ```bash
   npm run type-check
   ```

3. Check for linting errors:
   ```bash
   npm run lint
   ```

## Contributing

1. Create a feature branch
2. Make your changes
3. Run `npm run validate` to ensure code quality
4. Commit your changes (pre-commit hooks will run automatically)
5. Push and create a pull request

See [contributing.md](./contributing.md) for detailed guidelines.

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: NestJS, TypeScript
- **Blockchain**: Stellar
- **Deployment**: Vercel (Frontend), Heroku (Backend)

## Support

- **Telegram**: [@PetChain Group](https://t.me/+Jw8HkvUhinw2YjE0)
- **Issues**: [GitHub Issues](https://github.com/DogStark/petChain-Frontend/issues)
- **Contact**: [@llins_x](https://t.me/llins_x)
