# Security Testing and Audit Workflow

This document defines the minimum repeatable security process for PetChain. It is intentionally practical: the repository runs automated dependency and static analysis checks in CI, while the team follows a lightweight but explicit manual review, penetration testing, and incident response process.

## Security Tooling

### Automated vulnerability scanning

- Frontend dependency scanning: `npm run security:audit`
- Backend dependency scanning: `npm --prefix backend run security:audit`
- Static analysis in CI: GitHub CodeQL for JavaScript and TypeScript

These checks are also executed in `.github/workflows/security.yml` on pull requests, pushes to `main`, manual dispatch, and a weekly Monday audit schedule.

## Security Code Review Process

Every pull request that touches authentication, authorization, API inputs, secrets, payments, file uploads, notifications, or data exports should include a security review pass.

Reviewers should verify:

- inputs are validated and sanitized at the boundary
- authorization checks are explicit and not inferred from client state
- secrets, tokens, API keys, and internal identifiers are not logged or hard-coded
- error responses do not leak sensitive implementation details
- new dependencies are justified and maintained
- export, sharing, and admin features respect least privilege
- rate limiting, audit logging, and monitoring behavior are preserved where applicable

## Penetration Testing Checklist

Use this checklist before major releases and at least once per quarter:

- test authentication and session flows:
  - invalid login handling
  - brute-force protections
  - session revocation behavior
  - password reset and account recovery
- test authorization boundaries:
  - user-to-user data isolation
  - admin-only pages and APIs
  - exported or shared record access
- test input handling:
  - SQL injection attempts
  - XSS payloads in forms and query parameters
  - file upload validation and content-type bypass attempts
  - path traversal payloads where filenames or paths are accepted
- test API misuse scenarios:
  - rate limit exhaustion
  - malformed request bodies
  - replaying sensitive requests
  - missing and expired token behavior
- test frontend security posture:
  - accidental secret exposure in client bundles
  - unsafe local storage usage
  - insecure redirects and open redirect behavior

Document findings with severity, reproduction steps, owner, and remediation target date.

## Incident Response Plan

### Severity levels

- Critical: active exploitation, credential leakage, production data exposure, or service-wide compromise
- High: confirmed vulnerability with realistic impact but no confirmed large-scale compromise
- Medium: issue requires remediation but has limited blast radius or mitigating controls
- Low: defense-in-depth improvements or low-likelihood findings

### Response workflow

1. Detect and triage the report or alert.
2. Classify severity and assign an incident owner.
3. Contain the issue:
   - revoke or rotate affected credentials
   - disable affected integrations or endpoints if needed
   - apply temporary access controls or rate limits
4. Investigate scope:
   - identify affected systems, users, and data
   - preserve logs, timelines, and evidence
5. Remediate:
   - patch the issue
   - backfill tests or workflow checks
   - verify the fix in staging or a controlled environment
6. Communicate:
   - notify internal stakeholders
   - prepare external communication if user impact exists
7. Recover and review:
   - confirm systems are stable
   - document root cause, blast radius, and follow-up actions

### Evidence to collect

- alert timestamps
- related commits and deployments
- impacted routes, jobs, or services
- logs and audit trails
- affected accounts, records, or environments

## Security Audit Schedule

- On every pull request:
  - automated CodeQL scan
  - frontend dependency audit
  - backend dependency audit
- Weekly:
  - scheduled GitHub Actions security workflow run
  - review new dependency vulnerabilities and open alerts
- Quarterly:
  - manual penetration testing checklist execution
  - review incident response readiness
  - review access controls, secrets handling, and export/share paths
- After any security incident:
  - run a focused post-incident audit on the affected area
  - convert lessons learned into new tests or workflow rules

## Developer Best Practices

- prefer maintained dependencies and remove unused packages promptly
- never commit secrets, tokens, or credentials
- validate inputs on the server even when the client already validates
- keep authorization decisions in trusted server-side layers
- log enough for investigation, but do not log sensitive payloads
- treat exports, admin tooling, and notification integrations as high-risk paths
- add tests for regressions whenever fixing a security issue
- update this document when the security workflow changes
