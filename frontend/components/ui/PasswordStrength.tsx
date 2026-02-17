'use client';

interface PasswordStrengthProps {
  password: string;
}

export default function PasswordStrength({ password }: PasswordStrengthProps) {
  const getStrength = (pwd: string): { level: number; label: string; color: string } => {
    if (!pwd) return { level: 0, label: '', color: '' };
    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;

    if (score <= 1) return { level: 1, label: 'Weak', color: 'var(--danger)' };
    if (score <= 2) return { level: 2, label: 'Fair', color: 'var(--warning)' };
    if (score <= 3) return { level: 3, label: 'Good', color: 'var(--primary)' };
    return { level: 4, label: 'Strong', color: 'var(--success)' };
  };

  const strength = getStrength(password);
  if (!password) return null;

  return (
    <div className="password-strength">
      <div className="password-strength-bars">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="password-strength-bar"
            style={{ background: i <= strength.level ? strength.color : undefined }}
          />
        ))}
      </div>
      <span className="password-strength-label" style={{ color: strength.color }}>
        {strength.label}
      </span>
    </div>
  );
}
