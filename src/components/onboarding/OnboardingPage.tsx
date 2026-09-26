import React, { useState } from 'react';
import { useApp } from '../../store/AppContext';
import { Card, Button, Input, Select, Textarea, Badge } from '../ui';
import { parseNaturalLanguage, formatParsedResult } from '../../engine/nlParser';
import type { DayOfWeek } from '../../types';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
}

const steps: OnboardingStep[] = [
  { id: 'welcome', title: 'Welcome to Amigo', description: 'Your adaptive personal scheduler' },
  { id: 'input', title: 'How would you like to start?', description: 'Choose your setup method' },
  { id: 'schedule', title: 'Your Schedule', description: 'Set your basic times' },
  { id: 'commitments', title: 'Fixed Commitments', description: 'Add your non-negotiable activities' },
  { id: 'tasks', title: 'Tasks & Goals', description: 'What do you want to accomplish?' },
  { id: 'preferences', title: 'Preferences', description: 'Fine-tune your experience' },
  { id: 'review', title: 'Review & Confirm', description: 'Check everything before we start' },
];

export function OnboardingPage() {
  const { actions } = useApp();
  const [currentStep, setCurrentStep] = useState(0);
  const [inputMethod, setInputMethod] = useState<'natural' | 'manual' | null>(null);

  // Natural language input
  const [nlInput, setNlInput] = useState('');
  const [nlParsed, setNlParsed] = useState<ReturnType<typeof parseNaturalLanguage> | null>(null);

  // Manual input
  const [wakeTime, setWakeTime] = useState('07:00');
  const [sleepTime, setSleepTime] = useState('23:00');
  const [breakDuration, setBreakDuration] = useState('10');
  const [transitionBuffer, setTransitionBuffer] = useState('10');

  // Commitments
  const [commitments, setCommitments] = useState<Array<{
    title: string; startTime: string; endTime: string; days: DayOfWeek[];
  }>>([]);
  const [newCommitTitle, setNewCommitTitle] = useState('');
  const [newCommitStart, setNewCommitStart] = useState('09:00');
  const [newCommitEnd, setNewCommitEnd] = useState('12:00');

  // Tasks
  const [taskList, setTaskList] = useState<Array<{
    title: string; duration: number; priority: string; timeOfDay: string;
  }>>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDuration, setNewTaskDuration] = useState('60');
  const [newTaskPriority, setNewTaskPriority] = useState('medium');
  const [newTaskTime, setNewTaskTime] = useState('');

  const step = steps[currentStep];

  const handleParseNL = () => {
    if (!nlInput.trim()) return;
    const parsed = parseNaturalLanguage(nlInput);
    setNlParsed(parsed);
  };

  const handleAddCommitment = () => {
    if (!newCommitTitle.trim()) return;
    setCommitments([...commitments, {
      title: newCommitTitle.trim(),
      startTime: newCommitStart,
      endTime: newCommitEnd,
      days: [1, 2, 3, 4, 5] as DayOfWeek[],
    }]);
    setNewCommitTitle('');
  };

  const handleAddTask = () => {
    if (!newTaskTitle.trim()) return;
    setTaskList([...taskList, {
      title: newTaskTitle.trim(),
      duration: parseInt(newTaskDuration) || 60,
      priority: newTaskPriority,
      timeOfDay: newTaskTime,
    }]);
    setNewTaskTitle('');
    setNewTaskDuration('60');
    setNewTaskPriority('medium');
    setNewTaskTime('');
  };

  const handleComplete = async () => {
    // Save preferences
    await actions.savePreferences({
      wakeUpTime: nlParsed?.wakeUpTime || wakeTime,
      sleepTime: nlParsed?.sleepTime || sleepTime,
      breakDurationMinutes: parseInt(breakDuration) || 10,
      transitionBufferMinutes: parseInt(transitionBuffer) || 10,
      personalizationEnabled: true,
    });

    // Save commitments from NL or manual
    const commitSource = nlParsed?.commitments.filter(c => c.isFixed && c.startTime && c.endTime) || [];
    for (const c of commitSource) {
      await actions.addCommitment({
        title: c.title,
        startTime: c.startTime!,
        endTime: c.endTime!,
        daysOfWeek: [1, 2, 3, 4, 5],
        isLocked: true,
      });
    }
    for (const c of commitments) {
      await actions.addCommitment({
        title: c.title,
        startTime: c.startTime,
        endTime: c.endTime,
        daysOfWeek: c.days,
        isLocked: true,
      });
    }

    // Save tasks from NL or manual
    const taskSource = nlParsed?.commitments.filter(c => !c.isFixed) || [];
    for (const t of taskSource) {
      await actions.addTask({
        title: t.title,
        estimatedDurationMinutes: t.durationMinutes || 60,
        priority: 'medium',
        isFixed: false,
        isLocked: false,
        isRecurring: true,
        preferredTimeOfDay: t.timeOfDay as any,
      });
    }
    for (const t of taskList) {
      await actions.addTask({
        title: t.title,
        estimatedDurationMinutes: t.duration,
        priority: t.priority as any,
        isFixed: false,
        isLocked: false,
        isRecurring: true,
        preferredTimeOfDay: (t.timeOfDay || undefined) as any,
      });
    }
  };

  const canProceed = () => {
    if (currentStep === 1) return inputMethod !== null;
    if (currentStep === 2) {
      if (inputMethod === 'natural') return nlParsed !== null;
      return true;
    }
    return true;
  };

  const renderStepContent = () => {
    switch (step.id) {
      case 'welcome':
        return (
          <div className="text-center py-8">
            <h2 className="text-2xl font-bold text-text-primary mb-3">Amigo</h2>
            <p className="text-sm text-text-secondary max-w-md mx-auto mb-6">
              An adaptive personal scheduler that learns how you actually use your time
              and continuously adjusts future schedules around your real behavior.
            </p>
            <div className="space-y-2 text-left max-w-sm mx-auto">
              <div className="flex items-start gap-2">
                <span className="text-accent mt-0.5">→</span>
                <span className="text-sm text-text-secondary">Creates realistic schedules from your commitments</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-accent mt-0.5">→</span>
                <span className="text-sm text-text-secondary">Tracks your actual behavior over time</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-accent mt-0.5">→</span>
                <span className="text-sm text-text-secondary">Adapts future schedules based on patterns</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-accent mt-0.5">→</span>
                <span className="text-sm text-text-secondary">All data stays on your device</span>
              </div>
            </div>
          </div>
        );

      case 'input':
        return (
          <div className="space-y-4">
            <p className="text-sm text-text-secondary mb-4">
              You can describe your schedule in natural language, or set things up manually step by step.
            </p>
            <button
              onClick={() => setInputMethod('natural')}
              className={`w-full text-left p-4 rounded border transition-colors ${
                inputMethod === 'natural' ? 'border-accent bg-accent-muted/20' : 'border-border-subtle hover:bg-surface-2'
              }`}
            >
              <div className="text-sm font-medium text-text-primary">Natural Language</div>
              <div className="text-xs text-text-secondary mt-1">
                Describe your day in your own words. Amigo will parse it and confirm before saving.
              </div>
            </button>
            <button
              onClick={() => setInputMethod('manual')}
              className={`w-full text-left p-4 rounded border transition-colors ${
                inputMethod === 'manual' ? 'border-accent bg-accent-muted/20' : 'border-border-subtle hover:bg-surface-2'
              }`}
            >
              <div className="text-sm font-medium text-text-primary">Manual Setup</div>
              <div className="text-xs text-text-secondary mt-1">
                Set each preference individually with full control over every detail.
              </div>
            </button>
          </div>
        );

      case 'schedule':
        if (inputMethod === 'natural') {
          return (
            <div className="space-y-4">
              <p className="text-sm text-text-secondary">
                Describe your typical day. Include wake-up time, fixed commitments, activities with durations, and sleep time.
              </p>
              <Textarea
                value={nlInput}
                onChange={e => { setNlInput(e.target.value); setNlParsed(null); }}
                placeholder="I wake up at 7, have college from 9 to 12, want to go to the gym for 1.5 hours in the evening, study DSA for 2 hours, work on my project for 2 hours, eat dinner around 8:30 and sleep by 11:30."
              />
              <Button variant="secondary" size="sm" onClick={handleParseNL} disabled={!nlInput.trim()}>
                Parse
              </Button>
              {nlParsed && (
                <Card>
                  <h3 className="text-sm font-medium text-text-primary mb-2">I understood:</h3>
                  <div className="space-y-1 mb-2">
                    {formatParsedResult(nlParsed).map((line, i) => (
                      <p key={i} className="text-sm text-text-secondary">• {line}</p>
                    ))}
                  </div>
                  {nlParsed.ambiguities.length > 0 && (
                    <div className="mb-2">
                      {nlParsed.ambiguities.map((a, i) => (
                        <p key={i} className="text-xs text-warning">⚠ {a}</p>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-text-tertiary">You can edit details in the next steps.</p>
                </Card>
              )}
            </div>
          );
        }
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Wake-up Time" type="time" value={wakeTime} onChange={e => setWakeTime(e.target.value)} />
              <Input label="Sleep Time" type="time" value={sleepTime} onChange={e => setSleepTime(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Break Duration (min)" type="number" min="0" max="30" value={breakDuration} onChange={e => setBreakDuration(e.target.value)} />
              <Input label="Transition Buffer (min)" type="number" min="0" max="30" value={transitionBuffer} onChange={e => setTransitionBuffer(e.target.value)} />
            </div>
          </div>
        );

      case 'commitments':
        return (
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">
              Add your fixed commitments (classes, work, meetings). These cannot be moved automatically.
              You can skip this step.
            </p>
            {commitments.length > 0 && (
              <div className="space-y-2">
                {commitments.map((c, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 bg-surface-2 rounded">
                    <div>
                      <span className="text-sm text-text-primary">{c.title}</span>
                      <span className="text-xs text-text-tertiary ml-2">{c.startTime}–{c.endTime}</span>
                    </div>
                    <button onClick={() => setCommitments(commitments.filter((_, idx) => idx !== i))} className="text-text-tertiary hover:text-danger text-xs">✕</button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2 items-end">
              <Input label="Activity" value={newCommitTitle} onChange={e => setNewCommitTitle(e.target.value)} placeholder="e.g., College" className="flex-1" />
              <Input label="Start" type="time" value={newCommitStart} onChange={e => setNewCommitStart(e.target.value)} />
              <Input label="End" type="time" value={newCommitEnd} onChange={e => setNewCommitEnd(e.target.value)} />
              <Button variant="secondary" size="md" onClick={handleAddCommitment} disabled={!newCommitTitle.trim()}>+</Button>
            </div>
          </div>
        );

      case 'tasks':
        return (
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">
              Add activities you want to include in your schedule. These are flexible and will be placed automatically.
              You can skip this step.
            </p>
            {taskList.length > 0 && (
              <div className="space-y-2">
                {taskList.map((t, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 bg-surface-2 rounded">
                    <div>
                      <span className="text-sm text-text-primary">{t.title}</span>
                      <span className="text-xs text-text-tertiary ml-2">{t.duration}min · {t.priority}</span>
                      {t.timeOfDay && <span className="text-xs text-text-muted ml-1">· {t.timeOfDay}</span>}
                    </div>
                    <button onClick={() => setTaskList(taskList.filter((_, idx) => idx !== i))} className="text-text-tertiary hover:text-danger text-xs">✕</button>
                  </div>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Input label="Activity" value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} placeholder="e.g., Study DSA" />
              <Input label="Duration (min)" type="number" min="5" max="240" value={newTaskDuration} onChange={e => setNewTaskDuration(e.target.value)} />
              <Select
                label="Priority"
                value={newTaskPriority}
                onChange={e => setNewTaskPriority(e.target.value)}
                options={[
                  { value: 'high', label: 'High' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'low', label: 'Low' },
                ]}
              />
              <Select
                label="Preferred Time"
                value={newTaskTime}
                onChange={e => setNewTaskTime(e.target.value)}
                options={[
                  { value: '', label: 'Any' },
                  { value: 'morning', label: 'Morning' },
                  { value: 'afternoon', label: 'Afternoon' },
                  { value: 'evening', label: 'Evening' },
                ]}
              />
            </div>
            <Button variant="secondary" size="sm" onClick={handleAddTask} disabled={!newTaskTitle.trim()}>
              + Add Activity
            </Button>
          </div>
        );

      case 'preferences':
        return (
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">
              A few more preferences to fine-tune your schedule. All optional.
            </p>
            <Card>
              <h3 className="text-xs font-medium text-text-tertiary uppercase mb-2">Automatic Suggestions</h3>
              <p className="text-xs text-text-secondary">
                The following will be automatically included in your schedule:
              </p>
              <div className="mt-2 space-y-1">
                {['Bath/shower', 'Breakfast', 'Lunch', 'Dinner', 'Short breaks between tasks', 'Wind-down before sleep', 'Personal/free time'].map(item => (
                  <div key={item} className="flex items-center gap-2 text-xs text-text-secondary">
                    <span className="text-text-muted">•</span> {item}
                  </div>
                ))}
              </div>
              <p className="text-xs text-text-tertiary mt-2">
                These can be edited or removed later in Settings.
              </p>
            </Card>
          </div>
        );

      case 'review':
        return (
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">
              Review your setup before we generate your first schedule.
            </p>
            <Card>
              <h3 className="text-xs font-medium text-text-tertiary uppercase mb-2">Schedule</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-text-secondary">Wake:</span>
                <span className="text-text-primary">{nlParsed?.wakeUpTime || wakeTime}</span>
                <span className="text-text-secondary">Sleep:</span>
                <span className="text-text-primary">{nlParsed?.sleepTime || sleepTime}</span>
              </div>
            </Card>
            {(commitments.length > 0 || (nlParsed?.commitments.filter(c => c.isFixed).length || 0) > 0) && (
              <Card>
                <h3 className="text-xs font-medium text-text-tertiary uppercase mb-2">
                  Fixed Commitments ({commitments.length + (nlParsed?.commitments.filter(c => c.isFixed).length || 0)})
                </h3>
                <div className="space-y-1">
                  {commitments.map((c, i) => (
                    <div key={i} className="text-sm text-text-secondary">{c.title}: {c.startTime}–{c.endTime}</div>
                  ))}
                  {nlParsed?.commitments.filter(c => c.isFixed).map((c, i) => (
                    <div key={`nl-${i}`} className="text-sm text-text-secondary">{c.title}: {c.startTime}–{c.endTime}</div>
                  ))}
                </div>
              </Card>
            )}
            {(taskList.length > 0 || (nlParsed?.commitments.filter(c => !c.isFixed).length || 0) > 0) && (
              <Card>
                <h3 className="text-xs font-medium text-text-tertiary uppercase mb-2">
                  Activities ({taskList.length + (nlParsed?.commitments.filter(c => !c.isFixed).length || 0)})
                </h3>
                <div className="space-y-1">
                  {taskList.map((t, i) => (
                    <div key={i} className="text-sm text-text-secondary">{t.title}: {t.duration}min ({t.priority})</div>
                  ))}
                  {nlParsed?.commitments.filter(c => !c.isFixed).map((c, i) => (
                    <div key={`nl-${i}`} className="text-sm text-text-secondary">{c.title}: {c.durationMinutes}min</div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Progress */}
        <div className="flex items-center gap-1 mb-6">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= currentStep ? 'bg-accent' : 'bg-surface-3'
              }`}
            />
          ))}
        </div>

        <Card>
          <div className="mb-6">
            <h2 className="text-base font-semibold text-text-primary">{step.title}</h2>
            <p className="text-xs text-text-secondary mt-1">{step.description}</p>
          </div>

          {renderStepContent()}

          <div className="flex justify-between mt-6 pt-4 border-t border-border-subtle">
            <Button
              variant="ghost"
              onClick={() => setCurrentStep(s => Math.max(0, s - 1))}
              disabled={currentStep === 0}
            >
              Back
            </Button>
            {currentStep < steps.length - 1 ? (
              <Button
                variant="primary"
                onClick={() => setCurrentStep(s => s + 1)}
                disabled={!canProceed()}
              >
                Continue
              </Button>
            ) : (
              <Button variant="primary" onClick={handleComplete}>
                Get Started
              </Button>
            )}
          </div>
        </Card>

        <p className="text-center text-xs text-text-muted mt-4">
          Step {currentStep + 1} of {steps.length} · You can change everything later
        </p>
      </div>
    </div>
  );
}
