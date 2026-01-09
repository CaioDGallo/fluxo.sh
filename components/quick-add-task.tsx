'use client';

import { useState, KeyboardEvent, useRef } from 'react';
import { parseTaskInput, type ParsedTask } from '@/lib/natural-language-parser';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { TaskForm } from '@/components/task-form';
import { useTranslations } from 'next-intl';
import { type Task } from '@/lib/schema';

interface QuickAddTaskProps {
  onSuccess?: () => void;
}

export function QuickAddTask({ onSuccess }: QuickAddTaskProps) {
  const [input, setInput] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedTask | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const t = useTranslations('quickAdd');
  const tCalendar = useTranslations('calendar');

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && input.trim()) {
      e.preventDefault();
      const parsed = parseTaskInput(input.trim());

      // Only open dialog if we have a title
      if (parsed.title) {
        setParsedData(parsed);
        setDialogOpen(true);
      }
    }
  }

  function handleDialogClose(open: boolean) {
    setDialogOpen(open);
    if (!open) {
      setParsedData(null);
      // Keep the input text so user can edit if needed
    }
  }

  function handleTaskCreated() {
    setDialogOpen(false);
    setParsedData(null);
    setInput(''); // Clear input after successful creation
    onSuccess?.();
  }

  // Convert parsed data to initial task values for TaskForm
  const initialTask = parsedData ? {
    title: parsedData.title,
    dueAt: parsedData.dueAt || new Date(),
    startAt: parsedData.startAt || null,
    durationMinutes: parsedData.durationMinutes || null,
    priority: parsedData.priority || 'medium',
    status: 'pending' as const,
    description: null,
    location: null,
  } : null;

  return (
    <>
      <Input
        ref={inputRef}
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t('placeholder')}
        className="max-w-md"
      />

      <AlertDialog open={dialogOpen} onOpenChange={handleDialogClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tCalendar('addTask')}</AlertDialogTitle>
          </AlertDialogHeader>
          {initialTask && (
            <TaskForm
              task={initialTask as Task}
              onSuccess={handleTaskCreated}
            />
          )}
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
