import { useEffect, useState } from 'react';
import {
  DEFAULT_WEIGHTS,
  type CalculationSettings,
} from '../types/attendance.js';

const STORAGE_KEY = 'attendly_settings_v1';

export function useAttendanceSettings() {
  const [settings, setSettings] = useState<CalculationSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          weights: { ...DEFAULT_WEIGHTS, ...(parsed.weights || {}) },
          method: parsed.method || 'raw-count',
          targetPercentage: parsed.targetPercentage !== undefined ? parsed.targetPercentage : 75,
        };
      }
    } catch {
      // Fallback to defaults
    }
    return {
      weights: DEFAULT_WEIGHTS,
      method: 'raw-count',
      targetPercentage: 75,
    };
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Handle storage quota or private browsing
    }
  }, [settings]);

  const resetToDefaults = () => {
    setSettings({
      weights: DEFAULT_WEIGHTS,
      method: 'raw-count',
      targetPercentage: 75,
    });
  };

  return {
    settings,
    setSettings,
    resetToDefaults,
  };
}
