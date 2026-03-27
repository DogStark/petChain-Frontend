import React from 'react';
import { getPasswordStrength, validatePassword } from '../utils/passwordPolicy';

interface Props {
  password: string;
}

export default function PasswordStrengthMeter({ password }: Props) {
  if (!password) return null;

  const strength = getPasswordStrength(password);
  const { errors } = validatePassword(password);

  const checks = [
    { label: 'At least 8 characters', pass: password.length >= 8 },
    { label: 'Uppercase letter', pass: /[A-Z]/.test(password) },
    { label: 'Lowercase letter', pass: /[a-z]/.test(password) },
    { label: 'Number', pass: /[0-9]/.test(password) },
    { label: 'Special character', pass: /[^A-Za-z0-9]/.test(password) },
  ];

  return (
    <div className="mt-2 space-y-2" data-testid="password-strength-meter">
      {/* Strength bar */}
      <div className="flex gap-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-1.5 flex-1 rounded-full transition-all duration-300"
            style={{
              backgroundColor: i <= strength.score ? strength.color : '#e5e7eb',
            }}
          />
        ))}
      </div>
      <p className="text-xs font-medium" style={{ color: strength.color }}>
        {strength.label}
      </p>
      {/* Checklist */}
      <ul className="space-y-0.5">
        {checks.map(({ label, pass }) => (
          <li
            key={label}
            className={`text-xs flex items-center gap-1 ${pass ? 'text-green-600' : 'text-gray-400'}`}
          >
            <span>{pass ? '✓' : '○'}</span>
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}
