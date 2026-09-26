import React, { useState } from 'react';
import { useApp } from '../../store/AppContext';
import { Card, Button, Input, Select, Modal, Badge, EmptyState, Tabs, Textarea } from '../ui';
import type { Task, Priority, TaskCategory } from '../../types';
import { parseNaturalLanguage, formatParsedResult } from '../../engine/nlParser';

export function TasksPage() {
  const { state, actions } = useApp();
  const [activeTab, setActiveTab] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showNLPModal, setShowNLPModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [nlpInput, setNlpInput] = useState('');
  const [nlpParsed, setNlpParsed] = useState<ReturnType<typeof parseNaturalLanguage> | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState('60');
  const [priority, setPriority] = useState<Priority>('medium');
  const [categoryId, setCategoryId] = useState('');
  const [isFixed, setIsFixed] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [deadline, setDeadline] = useState('');
  const [preferredTime, setPreferredTime] = useState('');

  const filteredTasks = state.tasks.filter(t => {
    if (activeTab === 'all') return true;
    if (activeTab === 'fixed') return t.isFixed;
    if (activeTab === 'flexible') return !t.isFixed;
    if (activeTab === 'recurring') return t.isRecurring;
    return true;
  });

  const resetForm = () => {
    setTitle('');
    setDuration('60');
    setPriority('medium');
    setCategoryId('');
    setIsFixed(false);
    setIsRecurring(false);
    setDeadline('');
    setPreferredTime('');
    setEditingTask(null);
  };

  const handleSave = async () => {
    if (!title.trim()) return;

    if (editingTask) {
      await actions.updateTask({
        ...editingTask,
        title: title.trim(),
        estimatedDurationMinutes: parseInt(duration) || 60,
        priority,
        categoryId: categoryId || undefined,
        isFixed,
        isRecurring,
        deadline: deadline || undefined,
        preferredTimeOfDay: preferredTime as any || undefined,
      });
    } else {
      await actions.addTask({
        title: title.trim(),
        estimatedDurationMinutes: parseInt(duration) || 60,
        priority,
        categoryId: categoryId || undefined,
        isFixed,
        isLocked: false,
        isRecurring,
        deadline: deadline || undefined,
        preferredTimeOfDay: preferredTime as any || undefined,
      });
    }

    resetForm();
    setShowAddModal(false);
  };

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    setTitle(task.title);
    setDuration(String(task.estimatedDurationMinutes));
    setPriority(task.priority);
    setCategoryId(task.categoryId || '');
    setIsFixed(task.isFixed);
    setIsRecurring(task.isRecurring);
    setDeadline(task.deadline || '');
    setPreferredTime(task.preferredTimeOfDay || '');
    setShowAddModal(true);
  };

  const handleNLP = () => {
    if (!nlpInput.trim()) return;
    const parsed = parseNaturalLanguage(nlpInput);
    setNlpParsed(parsed);
  };

  const handleNLPConfirm = async () => {
    if (!nlpParsed) return;

    // Save wake/sleep if provided
    if (nlpParsed.wakeUpTime || nlpParsed.sleepTime) {
      await actions.savePreferences({
        wakeUpTime: nlpParsed.wakeUpTime || state.preferences?.wakeUpTime || '07:00',
        sleepTime: nlpParsed.sleepTime || state.preferences?.sleepTime || '23:00',
      });
    }

    // Create tasks/commitments from parsed data
    for (const commitment of nlpParsed.commitments) {
      if (commitment.isFixed && commitment.startTime && commitment.endTime) {
        await actions.addCommitment({
          title: commitment.title,
          startTime: commitment.startTime,
          endTime: commitment.endTime,
          daysOfWeek: [1, 2, 3, 4, 5], // Weekdays default
          isLocked: true,
        });
      } else {
        await actions.addTask({
          title: commitment.title,
          estimatedDurationMinutes: commitment.durationMinutes || 60,
          priority: 'medium',
          isFixed: false,
          isLocked: false,
          isRecurring: true,
          preferredTimeOfDay: commitment.timeOfDay,
        });
      }
    }

    setNlpInput('');
    setNlpParsed(null);
    setShowNLPModal(false);
  };

  const priorityColors: Record<Priority, string> = {
    critical: 'danger',
    high: 'warning',
    medium: 'default',
    low: 'default',
  };

  return (
    <div>
      <header className="mb-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-semibold text-text-primary">Tasks</h1>
            <p className="text-sm text-text-secondary mt-0.5">{state.tasks.length} tasks</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setShowNLPModal(true)}>
              Natural Input
            </Button>
            <Button variant="primary" size="sm" onClick={() => { resetForm(); setShowAddModal(true); }}>
              + Add Task
            </Button>
          </div>
        </div>
      </header>

      <div className="mb-4">
        <Tabs
          tabs={[
            { id: 'all', label: 'All', count: state.tasks.length },
            { id: 'fixed', label: 'Fixed', count: state.tasks.filter(t => t.isFixed).length },
            { id: 'flexible', label: 'Flexible', count: state.tasks.filter(t => !t.isFixed).length },
            { id: 'recurring', label: 'Recurring', count: state.tasks.filter(t => t.isRecurring).length },
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
        />
      </div>

      {filteredTasks.length === 0 ? (
        <EmptyState
          title="No tasks yet"
          description="Add tasks to build your schedule, or use natural language input."
          action={
            <div className="flex gap-2">
              <Button variant="primary" size="sm" onClick={() => setShowAddModal(true)}>Add Task</Button>
              <Button variant="secondary" size="sm" onClick={() => setShowNLPModal(true)}>Natural Input</Button>
            </div>
          }
        />
      ) : (
        <div className="space-y-2">
          {filteredTasks.map(task => {
            const category = state.categories.find(c => c.id === task.categoryId);
            const executions = state.executions.filter(e => e.taskId === task.id);
            const avgActual = executions.filter(e => e.actualDurationMinutes).length > 0
              ? Math.round(executions.filter(e => e.actualDurationMinutes).reduce((s, e) => s + e.actualDurationMinutes!, 0) / executions.filter(e => e.actualDurationMinutes).length)
              : null;

            return (
              <Card key={task.id} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text-primary truncate">{task.title}</span>
                    <Badge variant={priorityColors[task.priority] as any}>{task.priority}</Badge>
                    {task.isFixed && <Badge variant="accent">Fixed</Badge>}
                    {task.isRecurring && <Badge>Recurring</Badge>}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-text-tertiary">
                    <span>{task.estimatedDurationMinutes} min estimated</span>
                    {avgActual && <span>{avgActual} min actual</span>}
                    {category && <span style={{ color: category.color }}>● {category.name}</span>}
                    {task.deadline && <span>Due: {task.deadline}</span>}
                    {task.preferredTimeOfDay && <span>Prefer: {task.preferredTimeOfDay}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => handleEdit(task)} aria-label="Edit">✎</Button>
                  <Button size="sm" variant="ghost" onClick={() => actions.deleteTask(task.id)} aria-label="Delete">⊗</Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => { setShowAddModal(false); resetForm(); }}
        title={editingTask ? 'Edit Task' : 'Add Task'}
      >
        <div className="space-y-4">
          <Input
            label="Title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g., Study DSA, Gym, Project work"
            autoFocus
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Duration (minutes)"
              type="number"
              min="5"
              max="480"
              value={duration}
              onChange={e => setDuration(e.target.value)}
            />
            <Select
              label="Priority"
              value={priority}
              onChange={e => setPriority(e.target.value as Priority)}
              options={[
                { value: 'critical', label: 'Critical' },
                { value: 'high', label: 'High' },
                { value: 'medium', label: 'Medium' },
                { value: 'low', label: 'Low' },
              ]}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Category"
              value={categoryId}
              onChange={e => setCategoryId(e.target.value)}
              options={[
                { value: '', label: 'None' },
                ...state.categories.map(c => ({ value: c.id, label: c.name })),
              ]}
            />
            <Select
              label="Preferred Time"
              value={preferredTime}
              onChange={e => setPreferredTime(e.target.value)}
              options={[
                { value: '', label: 'Any' },
                { value: 'morning', label: 'Morning' },
                { value: 'afternoon', label: 'Afternoon' },
                { value: 'evening', label: 'Evening' },
                { value: 'night', label: 'Night' },
              ]}
            />
          </div>
          <Input
            label="Deadline"
            type="date"
            value={deadline}
            onChange={e => setDeadline(e.target.value)}
          />
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
              <input type="checkbox" checked={isFixed} onChange={e => setIsFixed(e.target.checked)} className="rounded" />
              Fixed (cannot be moved)
            </label>
            <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
              <input type="checkbox" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)} className="rounded" />
              Recurring
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => { setShowAddModal(false); resetForm(); }}>Cancel</Button>
            <Button variant="primary" onClick={handleSave} disabled={!title.trim()}>
              {editingTask ? 'Update' : 'Add Task'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Natural Language Modal */}
      <Modal
        isOpen={showNLPModal}
        onClose={() => { setShowNLPModal(false); setNlpInput(''); setNlpParsed(null); }}
        title="Natural Language Input"
        size="lg"
      >
        <div className="space-y-4">
          <Textarea
            label="Describe your schedule"
            value={nlpInput}
            onChange={e => { setNlpInput(e.target.value); setNlpParsed(null); }}
            placeholder="I wake up at 7, have college from 9 to 12, want to go to the gym for 1.5 hours in the evening, study DSA for 2 hours, work on my project for 2 hours, eat dinner around 8:30 and sleep by 11:30."
          />
          <Button variant="secondary" onClick={handleNLP} disabled={!nlpInput.trim()}>
            Parse Input
          </Button>

          {nlpParsed && (
            <Card>
              <h3 className="text-sm font-medium text-text-primary mb-2">I understood:</h3>
              <div className="space-y-1 mb-3">
                {nlpParsed.wakeUpTime && <p className="text-sm text-text-secondary">Wake up: {nlpParsed.wakeUpTime}</p>}
                {nlpParsed.sleepTime && <p className="text-sm text-text-secondary">Sleep: {nlpParsed.sleepTime}</p>}
                {formatParsedResult(nlpParsed).map((line, i) => (
                  <p key={i} className="text-sm text-text-secondary">• {line}</p>
                ))}
              </div>
              {nlpParsed.ambiguities.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-warning mb-1">Ambiguities:</p>
                  {nlpParsed.ambiguities.map((a, i) => (
                    <p key={i} className="text-xs text-text-tertiary">• {a}</p>
                  ))}
                </div>
              )}
              <Button variant="primary" onClick={handleNLPConfirm}>
                Confirm & Save
              </Button>
            </Card>
          )}
        </div>
      </Modal>
    </div>
  );
}
