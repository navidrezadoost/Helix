'use client';

import * as React from 'react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/style.css';

import { cn } from '@/lib/utils';

function Calendar({
  className,
  showOutsideDays = true,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  const DayPickerComponent = DayPicker as any;

  return (
    <DayPickerComponent
      showOutsideDays={showOutsideDays}
      className={cn('rounded-md border bg-background p-3', className)}
      {...props}
    />
  );
}

export { Calendar };
