interface ParsedSchedule {
  wakeUpTime?: string;
  sleepTime?: string;
  commitments: ParsedCommitment[];
  ambiguities: string[];
}

interface ParsedCommitment {
  title: string;
  startTime?: string;
  endTime?: string;
  durationMinutes?: number;
  isFixed: boolean;
  timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night';
}

function parseTime(text: string): string | null {
  // Match patterns like "9:00 AM", "9 AM", "9:30", "13:00", "9am"
  const patterns = [
    /(\d{1,2}):(\d{2})\s*(am|pm|AM|PM)?/i,
    /(\d{1,2})\s*(am|pm|AM|PM)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      let hours = parseInt(match[1]);
      let minutes = match[2] ? parseInt(match[2]) : 0;
      const ampm = match[3]?.toLowerCase();

      if (ampm === 'pm' && hours < 12) hours += 12;
      if (ampm === 'am' && hours === 12) hours = 0;

      if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      }
    }
  }
  return null;
}

function parseDuration(text: string): number | null {
  // Match patterns like "1.5 hours", "2 hours", "30 minutes", "1h 30m", "90 min"
  const patterns = [
    /(\d+\.?\d*)\s*(hours?|hrs?|h)\s*(\d+)?\s*(minutes?|mins?|m)?/i,
    /(\d+)\s*(minutes?|mins?|m)/i,
    /(\d+\.?\d*)\s*(hours?|hrs?)/i,
  ];

  // Check for "X hours Y minutes" pattern
  const hourMinMatch = text.match(/(\d+\.?\d*)\s*(hours?|hrs?|h)\s*(?:and\s*)?(\d+)\s*(minutes?|mins?|m)/i);
  if (hourMinMatch) {
    const hours = parseFloat(hourMinMatch[1]);
    const mins = parseInt(hourMinMatch[3]);
    return Math.round(hours * 60 + mins);
  }

  // Check for "X.Y hours" or "X hours"
  const hourMatch = text.match(/(\d+\.?\d*)\s*(hours?|hrs?|h)(?!.*\d+\s*min)/i);
  if (hourMatch) {
    return Math.round(parseFloat(hourMatch[1]) * 60);
  }

  // Check for minutes
  const minMatch = text.match(/(\d+)\s*(minutes?|mins?|m)(?!.*hour)/i);
  if (minMatch) {
    return parseInt(minMatch[1]);
  }

  return null;
}

function detectTimeOfDay(text: string): 'morning' | 'afternoon' | 'evening' | 'night' | undefined {
  const lower = text.toLowerCase();
  if (/\b(morning|before noon|am)\b/.test(lower)) return 'morning';
  if (/\b(afternoon|after noon|post lunch)\b/.test(lower)) return 'afternoon';
  if (/\b(evening|after work|after college|after office|night)\b/.test(lower)) return 'evening';
  if (/\b(late night|before bed)\b/.test(lower)) return 'night';
  return undefined;
}

export function parseNaturalLanguage(input: string): ParsedSchedule {
  const result: ParsedSchedule = {
    commitments: [],
    ambiguities: [],
  };

  const sentences = input.split(/[.;\n]/).map(s => s.trim()).filter(s => s.length > 0);

  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();

    // Wake up detection
    if (/\b(wake\s*up|get\s*up|rise)\b/.test(lower)) {
      const time = parseTime(sentence);
      if (time) {
        result.wakeUpTime = time;
      } else {
        result.ambiguities.push('You mentioned waking up but I couldn\'t determine the time.');
      }
      continue;
    }

    // Sleep/bed detection
    if (/\b(sleep|bed|go to bed|sleep at)\b/.test(lower)) {
      const time = parseTime(sentence);
      if (time) {
        result.sleepTime = time;
      } else {
        result.ambiguities.push('You mentioned sleep but I couldn\'t determine the time.');
      }
      continue;
    }

    // Fixed time range (e.g., "college from 9 to 12")
    const rangeMatch = sentence.match(/(.+?)\s+(?:from|between)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s+(?:to|and|-|–)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
    if (rangeMatch) {
      const title = rangeMatch[1].trim().replace(/^(I have|I go to|my|the)\s*/i, '');
      const start = parseTime(rangeMatch[2]);
      const end = parseTime(rangeMatch[3]);
      
      if (start && end) {
        result.commitments.push({
          title: title.charAt(0).toUpperCase() + title.slice(1),
          startTime: start,
          endTime: end,
          isFixed: true,
        });
        continue;
      }
    }

    // Activity with duration (e.g., "gym for 1.5 hours")
    const durationMatch = sentence.match(/(.+?)\s+(?:for|about|around|approximately)?\s*(\d+\.?\d*\s*(?:hours?|hrs?|minutes?|mins?)(?:\s*(?:and\s*)?\d+\s*(?:minutes?|mins?))?)/i);
    if (durationMatch) {
      const title = durationMatch[1].trim().replace(/^(I want to|I need to|I should|I'll|I will|go to|do)\s*/i, '');
      const duration = parseDuration(durationMatch[2]);
      const timeOfDay = detectTimeOfDay(sentence);
      const time = parseTime(sentence);

      if (duration && title.length > 1) {
        const commitment: ParsedCommitment = {
          title: title.charAt(0).toUpperCase() + title.slice(1),
          durationMinutes: duration,
          isFixed: false,
          timeOfDay,
        };

        if (time) {
          commitment.startTime = time;
          commitment.isFixed = true;
        }

        result.commitments.push(commitment);
        continue;
      }
    }

    // Meal times (e.g., "lunch at 1", "dinner around 8:30")
    const mealMatch = sentence.match(/\b(breakfast|lunch|dinner|snack)\b.*?(?:at|around|about)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
    if (mealMatch) {
      const meal = mealMatch[1].charAt(0).toUpperCase() + mealMatch[1].slice(1);
      const time = parseTime(mealMatch[2]);
      if (time) {
        result.commitments.push({
          title: meal,
          startTime: time,
          isFixed: true,
          durationMinutes: 30,
        });
        continue;
      }
    }

    // Generic activity mention
    const activityMatch = sentence.match(/(?:want to|need to|should|will|plan to|go)\s+(.+)/i);
    if (activityMatch) {
      const activity = activityMatch[1].trim();
      const duration = parseDuration(sentence);
      const time = parseTime(sentence);
      const timeOfDay = detectTimeOfDay(sentence);

      if (activity.length > 2) {
        result.commitments.push({
          title: activity.charAt(0).toUpperCase() + activity.slice(1),
          durationMinutes: duration || undefined,
          startTime: time || undefined,
          isFixed: !!time,
          timeOfDay,
        });
      }
    }
  }

  // Check for ambiguities
  if (result.commitments.some(c => !c.durationMinutes && !c.endTime)) {
    result.ambiguities.push('Some activities don\'t have a specified duration. I\'ll use defaults or you can specify them.');
  }

  if (result.commitments.some(c => !c.startTime && !c.timeOfDay)) {
    result.ambiguities.push('Some activities don\'t have a preferred time. I\'ll schedule them based on your patterns.');
  }

  return result;
}

export function formatParsedResult(parsed: ParsedSchedule): string[] {
  const lines: string[] = [];

  if (parsed.wakeUpTime) lines.push(`Wake up: ${parsed.wakeUpTime}`);
  if (parsed.sleepTime) lines.push(`Sleep: ${parsed.sleepTime}`);

  for (const c of parsed.commitments) {
    let line = c.title;
    if (c.startTime && c.endTime) {
      line += ` — ${c.startTime} to ${c.endTime} (fixed)`;
    } else if (c.startTime) {
      line += ` — at ${c.startTime}`;
    } else if (c.durationMinutes) {
      const hours = Math.floor(c.durationMinutes / 60);
      const mins = c.durationMinutes % 60;
      const durStr = hours > 0 ? `${hours}h${mins > 0 ? ` ${mins}m` : ''}` : `${mins}m`;
      line += ` — ${durStr}${c.timeOfDay ? ` (${c.timeOfDay})` : ''} (flexible)`;
    }
    lines.push(line);
  }

  return lines;
}
