import React, { useState } from 'react';
import { useApp } from '../../store/AppContext';
import { Card, Button, Input, Select, Toggle, Modal, Badge } from '../ui';

interface SettingsPageProps {
  onLogout?: () => void;
  userEmail?: string;
}

export function SettingsPage({ onLogout, userEmail }: SettingsPageProps) {
  const { state, actions } = useApp();
  const { preferences, categories, tasks, executions } = state;
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#3b82f6');

  const [wakeTime, setWakeTime] = useState(preferences?.wakeUpTime || '07:00');
  const [sleepTime, setSleepTime] = useState(preferences?.sleepTime || '23:00');
  const [breakDuration, setBreakDuration] = useState(String(preferences?.breakDurationMinutes || 10));
  const [transitionBuffer, setTransitionBuffer] = useState(String(preferences?.transitionBufferMinutes || 10));
  const [maxWork, setMaxWork] = useState(String(preferences?.maxConsecutiveWorkMinutes || 90));
  const [personalization, setPersonalization] = useState(preferences?.personalizationEnabled ?? true);

  const handleSavePreferences = async () => {
    await actions.savePreferences({
      wakeUpTime: wakeTime,
      sleepTime: sleepTime,
      breakDurationMinutes: parseInt(breakDuration) || 10,
      transitionBufferMinutes: parseInt(transitionBuffer) || 10,
      maxConsecutiveWorkMinutes: parseInt(maxWork) || 90,
      personalizationEnabled: personalization,
    });
  };

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;
    await actions.addCategory(newCatName.trim(), newCatColor);
    setNewCatName('');
    setShowCategoryModal(false);
  };

  const handleDeleteAll = async () => {
    await actions.deleteAllData();
    setShowDeleteModal(false);
  };

  const handleExportData = () => {
    const data = {
      preferences,
      tasks,
      categories,
      executions,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `amigo-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-lg font-semibold text-text-primary">Settings</h1>
        <p className="text-sm text-text-secondary mt-0.5">Configure your scheduling preferences</p>
      </header>

      <div className="space-y-6 max-w-2xl">
        {/* Schedule Preferences */}
        <Card>
          <h2 className="text-sm font-medium text-text-primary mb-4">Schedule Preferences</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Wake-up Time"
                type="time"
                value={wakeTime}
                onChange={e => setWakeTime(e.target.value)}
              />
              <Input
                label="Sleep Time"
                type="time"
                value={sleepTime}
                onChange={e => setSleepTime(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Input
                label="Break Duration (min)"
                type="number"
                min="0"
                max="30"
                value={breakDuration}
                onChange={e => setBreakDuration(e.target.value)}
              />
              <Input
                label="Transition Buffer (min)"
                type="number"
                min="0"
                max="30"
                value={transitionBuffer}
                onChange={e => setTransitionBuffer(e.target.value)}
              />
              <Input
                label="Max Work Block (min)"
                type="number"
                min="30"
                max="240"
                value={maxWork}
                onChange={e => setMaxWork(e.target.value)}
              />
            </div>
            <Button variant="primary" size="sm" onClick={handleSavePreferences}>
              Save Preferences
            </Button>
          </div>
        </Card>

        {/* Personalization */}
        <Card>
          <h2 className="text-sm font-medium text-text-primary mb-4">Personalization</h2>
          <div className="space-y-4">
            <Toggle
              checked={personalization}
              onChange={async (val) => {
                setPersonalization(val);
                await actions.savePreferences({ personalizationEnabled: val });
              }}
              label="Enable adaptive personalization"
            />
            <p className="text-xs text-text-tertiary">
              When enabled, the system tracks your task completion patterns and adjusts future schedules
              to match your actual behavior. You can disable this at any time.
            </p>
            <div className="flex items-center gap-4 text-xs text-text-tertiary">
              <span>Data points: {executions.length}</span>
              <span>Tasks: {tasks.length}</span>
              <span>Categories: {categories.length}</span>
            </div>
          </div>
        </Card>

        {/* Categories */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-text-primary">Categories</h2>
            <Button size="sm" variant="secondary" onClick={() => setShowCategoryModal(true)}>
              + Add
            </Button>
          </div>
          {categories.length > 0 ? (
            <div className="space-y-2">
              {categories.map(cat => (
                <div key={cat.id} className="flex items-center gap-2 px-3 py-2 bg-surface-2 rounded">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                  <span className="text-sm text-text-primary">{cat.name}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-text-tertiary">No categories yet. Add categories to organize tasks.</p>
          )}
        </Card>

        {/* Data Management */}
        <Card>
          <h2 className="text-sm font-medium text-text-primary mb-4">Data Management</h2>
          <div className="space-y-3">
            <Button variant="secondary" size="sm" onClick={handleExportData}>
              Export Data (JSON)
            </Button>
            <div className="border-t border-border-subtle pt-3">
              <Button variant="danger" size="sm" onClick={() => setShowDeleteModal(true)}>
                Delete All Data
              </Button>
              <p className="text-xs text-text-tertiary mt-2">
                This will permanently delete all your tasks, schedules, and behavioral data.
              </p>
            </div>
          </div>
        </Card>

        {/* About */}
        <Card>
          <h2 className="text-sm font-medium text-text-primary mb-2">About Amigo</h2>
          <p className="text-xs text-text-secondary">
            Amigo is an adaptive personal scheduler that learns from your behavior to create
            realistic schedules. All data is stored locally in your browser.
          </p>
          <div className="mt-3 text-xs text-text-tertiary">
            <p>Version 1.0.0</p>
            <p>Data stored: IndexedDB (local)</p>
            {userEmail && <p>Signed in as: {userEmail}</p>}
          </div>
          {onLogout && (
            <div className="mt-4 pt-3 border-t border-border-subtle">
              <Button variant="secondary" size="sm" onClick={onLogout}>
                Sign Out
              </Button>
            </div>
          )}
        </Card>
      </div>

      {/* Category Modal */}
      <Modal
        isOpen={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        title="Add Category"
        size="sm"
      >
        <div className="space-y-4">
          <Input
            label="Category Name"
            value={newCatName}
            onChange={e => setNewCatName(e.target.value)}
            placeholder="e.g., Study, Exercise, Work"
            autoFocus
          />
          <div>
            <label className="text-xs font-medium text-text-secondary block mb-1">Color</label>
            <div className="flex gap-2">
              {['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316'].map(color => (
                <button
                  key={color}
                  onClick={() => setNewCatColor(color)}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${newCatColor === color ? 'border-white scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: color }}
                  aria-label={`Select color ${color}`}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowCategoryModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleAddCategory} disabled={!newCatName.trim()}>Add</Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete All Data"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            This will permanently delete all your data including tasks, schedules, categories,
            and behavioral history. This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
            <Button variant="danger" onClick={handleDeleteAll}>Delete Everything</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
