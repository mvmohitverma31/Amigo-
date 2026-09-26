import React, { type ButtonHTMLAttributes, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, type ReactNode } from 'react';

// Button
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: ReactNode;
}

export function Button({ variant = 'primary', size = 'md', loading, children, className = '', disabled, ...props }: ButtonProps) {
  const base = 'inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
  const variants = {
    primary: 'bg-accent text-white hover:bg-accent-hover',
    secondary: 'bg-surface-3 text-text-primary border border-border-default hover:bg-surface-4',
    ghost: 'text-text-secondary hover:text-text-primary hover:bg-surface-3',
    danger: 'bg-danger text-white hover:bg-red-600',
    success: 'bg-success text-white hover:bg-green-600',
  };
  const sizes = {
    sm: 'px-2.5 py-1 text-xs rounded',
    md: 'px-3.5 py-1.5 text-sm rounded',
    lg: 'px-5 py-2.5 text-base rounded',
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <span className="mr-2 animate-spin">⟳</span>}
      {children}
    </button>
  );
}

// Input
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Input({ label, error, hint, className = '', id, ...props }: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="flex flex-col gap-1">
      {label && <label htmlFor={inputId} className="text-xs font-medium text-text-secondary">{label}</label>}
      <input
        id={inputId}
        className={`bg-surface-2 border border-border-default rounded px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none transition-colors ${error ? 'border-danger' : ''} ${className}`}
        {...props}
      />
      {error && <span className="text-xs text-danger">{error}</span>}
      {hint && !error && <span className="text-xs text-text-tertiary">{hint}</span>}
    </div>
  );
}

// Select
interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export function Select({ label, error, options, className = '', id, ...props }: SelectProps) {
  const selectId = id || label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="flex flex-col gap-1">
      {label && <label htmlFor={selectId} className="text-xs font-medium text-text-secondary">{label}</label>}
      <select
        id={selectId}
        className={`bg-surface-2 border border-border-default rounded px-3 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none transition-colors ${error ? 'border-danger' : ''} ${className}`}
        {...props}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}

// Textarea
interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, className = '', id, ...props }: TextareaProps) {
  const textareaId = id || label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="flex flex-col gap-1">
      {label && <label htmlFor={textareaId} className="text-xs font-medium text-text-secondary">{label}</label>}
      <textarea
        id={textareaId}
        className={`bg-surface-2 border border-border-default rounded px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none transition-colors resize-y min-h-[80px] ${error ? 'border-danger' : ''} ${className}`}
        {...props}
      />
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}

// Card
interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: boolean;
}

export function Card({ children, className = '', padding = true }: CardProps) {
  return (
    <div className={`bg-surface-1 border border-border-subtle rounded ${padding ? 'p-4' : ''} ${className}`}>
      {children}
    </div>
  );
}

// Badge
type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  const variants = {
    default: 'bg-surface-3 text-text-secondary',
    success: 'bg-success-muted text-success',
    warning: 'bg-warning-muted text-warning',
    danger: 'bg-danger-muted text-danger',
    info: 'bg-cyan-950 text-info',
    accent: 'bg-accent-muted text-accent',
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}

// Progress Bar
interface ProgressProps {
  value: number;
  max?: number;
  label?: string;
  showValue?: boolean;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

export function Progress({ value, max = 100, label, showValue = true, variant = 'default' }: ProgressProps) {
  const percent = Math.min(100, Math.max(0, (value / max) * 100));
  const colors = {
    default: 'bg-accent',
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-danger',
  };

  return (
    <div className="flex flex-col gap-1">
      {(label || showValue) && (
        <div className="flex justify-between text-xs">
          {label && <span className="text-text-secondary">{label}</span>}
          {showValue && <span className="text-text-tertiary">{Math.round(percent)}%</span>}
        </div>
      )}
      <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden">
        <div
          className={`h-full ${colors[variant]} rounded-full transition-all duration-300`}
          style={{ width: `${percent}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
        />
      </div>
    </div>
  );
}

// Modal
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  if (!isOpen) return null;

  const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className={`relative bg-surface-1 border border-border-default rounded-lg w-full ${sizes[size]} max-h-[85vh] overflow-y-auto`}>
        <div className="flex items-center justify-between p-4 border-b border-border-subtle">
          <h2 className="text-base font-semibold text-text-primary">{title}</h2>
          <button
            onClick={onClose}
            className="text-text-tertiary hover:text-text-primary p-1 rounded"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="p-4">
          {children}
        </div>
      </div>
    </div>
  );
}

// Toast notification
interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning';
  onDismiss: () => void;
}

export function Toast({ message, type = 'info', onDismiss }: ToastProps) {
  const colors = {
    success: 'border-success bg-success-muted',
    error: 'border-danger bg-danger-muted',
    info: 'border-accent bg-accent-muted',
    warning: 'border-warning bg-warning-muted',
  };

  React.useEffect(() => {
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded border ${colors[type]} text-sm text-text-primary shadow-lg`}>
      <div className="flex items-center gap-3">
        <span>{message}</span>
        <button onClick={onDismiss} className="text-text-tertiary hover:text-text-primary" aria-label="Dismiss">✕</button>
      </div>
    </div>
  );
}

// Empty State
interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-12 h-12 rounded-full bg-surface-3 flex items-center justify-center mb-4">
        <span className="text-text-tertiary text-lg">∅</span>
      </div>
      <h3 className="text-sm font-medium text-text-primary mb-1">{title}</h3>
      {description && <p className="text-xs text-text-secondary mb-4 max-w-xs">{description}</p>}
      {action}
    </div>
  );
}

// Metric Display
interface MetricProps {
  label: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
}

export function Metric({ label, value, subtitle, trend }: MetricProps) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-text-tertiary uppercase tracking-wide">{label}</span>
      <div className="flex items-baseline gap-1.5">
        <span className="text-xl font-semibold text-text-primary tabular-nums">{value}</span>
        {trend && (
          <span className={`text-xs ${trend === 'up' ? 'text-success' : trend === 'down' ? 'text-danger' : 'text-text-tertiary'}`}>
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
          </span>
        )}
      </div>
      {subtitle && <span className="text-xs text-text-secondary">{subtitle}</span>}
    </div>
  );
}

// Tab Navigation
interface TabProps {
  tabs: { id: string; label: string; count?: number }[];
  activeTab: string;
  onChange: (id: string) => void;
}

export function Tabs({ tabs, activeTab, onChange }: TabProps) {
  return (
    <div className="flex border-b border-border-subtle" role="tablist">
      {tabs.map(tab => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={activeTab === tab.id}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === tab.id
              ? 'border-accent text-text-primary'
              : 'border-transparent text-text-tertiary hover:text-text-secondary'
          }`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className="ml-1.5 text-xs text-text-muted">({tab.count})</span>
          )}
        </button>
      ))}
    </div>
  );
}

// Toggle
interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, label, disabled }: ToggleProps) {
  return (
    <label className={`inline-flex items-center gap-2 ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
      <button
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative w-9 h-5 rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-surface-4'}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-4' : ''}`}
        />
      </button>
      {label && <span className="text-sm text-text-secondary">{label}</span>}
    </label>
  );
}
