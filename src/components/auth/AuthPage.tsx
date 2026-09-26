import React, { useState } from 'react';
import { Card, Button, Input, Toggle } from '../ui';

interface AuthPageProps {
  mode: 'login' | 'register';
  onSwitchMode: () => void;
  onSubmit: (data: { email: string; password: string; displayName?: string }) => Promise<void>;
  error?: string | null;
  loading?: boolean;
}

export function AuthPage({ mode, onSwitchMode, onSubmit, error, loading }: AuthPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // Validation
    if (!email.trim()) {
      setValidationError('Email is required');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setValidationError('Please enter a valid email address');
      return;
    }
    if (password.length < 8) {
      setValidationError('Password must be at least 8 characters');
      return;
    }
    if (mode === 'register' && !displayName.trim()) {
      setValidationError('Display name is required');
      return;
    }

    await onSubmit({
      email: email.trim(),
      password,
      displayName: mode === 'register' ? displayName.trim() : undefined,
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface-0">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-text-primary">Amigo</h1>
          <p className="text-xs text-text-tertiary mt-1">Adaptive Personal Scheduler</p>
        </div>

        <Card>
          <h2 className="text-base font-semibold text-text-primary mb-4">
            {mode === 'login' ? 'Sign in' : 'Create account'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <Input
                label="Display Name"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Your name"
                autoComplete="name"
                autoFocus
              />
            )}

            <Input
              label="Email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              autoFocus={mode === 'login'}
            />

            <div className="flex flex-col gap-1">
              <label htmlFor="password" className="text-xs font-medium text-text-secondary">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  className="w-full bg-surface-2 border border-border-default rounded px-3 py-1.5 pr-10 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary text-xs px-1"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              {mode === 'register' && (
                <p className="text-xs text-text-tertiary">Use a strong, unique password</p>
              )}
            </div>

            {(error || validationError) && (
              <div className="px-3 py-2 bg-danger-muted border border-danger/30 rounded text-xs text-danger" role="alert">
                {error || validationError}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              loading={loading}
              className="w-full"
            >
              {mode === 'login' ? 'Sign in' : 'Create account'}
            </Button>
          </form>

          <div className="mt-4 pt-4 border-t border-border-subtle text-center">
            <button
              onClick={onSwitchMode}
              className="text-xs text-text-secondary hover:text-accent transition-colors"
            >
              {mode === 'login'
                ? "Don't have an account? Create one"
                : 'Already have an account? Sign in'}
            </button>
          </div>
        </Card>

        <p className="text-center text-xs text-text-muted mt-4">
          Your data is stored securely. Passwords are hashed with Argon2id.
        </p>
      </div>
    </div>
  );
}
