import React, { useState } from 'react';
import { Button, Input } from '../ui';

interface AuthPageProps {
  onSubmit: (displayName: string) => Promise<void>;
  error?: string | null;
  loading?: boolean;
}

export function AuthPage({ onSubmit, error, loading }: AuthPageProps) {
  const [displayName, setDisplayName] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!displayName.trim()) {
      setValidationError('Please enter your name');
      return;
    }

    await onSubmit(displayName.trim());
  };

  return (
    <div className="min-h-screen bg-surface-0 p-5 text-text-primary md:p-8">
      <div className="mx-auto grid min-h-[calc(100vh-2.5rem)] max-w-6xl overflow-hidden border border-border-default bg-surface-1 md:min-h-[calc(100vh-4rem)] md:grid-cols-[1.15fr_0.85fr]">
        <section className="relative flex min-h-[360px] flex-col justify-between overflow-hidden bg-accent p-7 text-surface-0 md:p-12">
          <div className="relative z-10 flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center border-2 border-surface-0 text-lg font-black">A</span>
            <span className="text-sm font-bold uppercase tracking-[0.18em]">Amigo</span>
          </div>
          <div className="relative z-10 max-w-md py-12">
            <p className="mb-4 text-xs font-bold uppercase tracking-[0.2em] opacity-70">Your day, in motion</p>
            <h1 className="max-w-lg text-5xl font-black leading-[0.92] tracking-[-0.06em] md:text-7xl">Make room for what matters.</h1>
            <p className="mt-6 max-w-sm text-sm font-medium leading-6 opacity-80">A thoughtful daily rhythm for the work, people, and pauses you want to keep close.</p>
          </div>
          <div className="relative z-10 flex items-end justify-between border-t border-surface-0/20 pt-4 text-xs font-semibold uppercase tracking-[0.14em]">
            <span>Adaptive planning</span>
            <span>01 / 03</span>
          </div>
          <div className="absolute -bottom-20 -right-12 h-64 w-64 rounded-full border-[28px] border-surface-0/15" />
          <div className="absolute right-24 top-20 h-20 w-20 rotate-12 border-8 border-surface-0/20" />
        </section>

        <section className="flex items-center bg-surface-1 p-7 md:p-12">
          <div className="w-full max-w-sm">
            <div className="mb-10">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-text-tertiary">A quiet start</p>
              <h2 className="text-3xl font-black tracking-[-0.04em] text-text-primary">What should we call you?</h2>
              <p className="mt-3 text-sm leading-6 text-text-secondary">No account, inbox, or setup ceremony. Just your name, and we’ll take it from there.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <Input
                label="Your name"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="e.g. Hannah"
                autoComplete="name"
                autoFocus
                className="h-12 bg-surface-2 px-4 text-base"
              />

              {(error || validationError) && (
                <div className="border border-danger/40 bg-danger-muted px-3 py-2 text-xs text-danger" role="alert">
                  {error || validationError}
                </div>
              )}

              <Button type="submit" variant="primary" loading={loading} className="h-12 w-full text-sm uppercase tracking-[0.12em]">
                Start planning
              </Button>
            </form>

            <p className="mt-8 text-xs leading-5 text-text-tertiary">Your plans stay on this device. You can change or remove your data any time.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
