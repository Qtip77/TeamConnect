// This is a Server Component by default in Next.js App Router
import React from 'react';
import { requireDriver } from '@/lib/auth-utils';
import { TimesheetSubmissionForm } from '@/components/forms/timesheet-submission-form';

export default async function NewTimesheetPage() {
  // Perform server-side authentication check
  // requireDriver will redirect if the user is not a driver or not authenticated.
  await requireDriver('/login'); 

  // If requireDriver doesn't redirect, the user is authorized.
  // We can now render the page content, including client components.
  return (
    <div className="container mx-auto py-10">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center">Submit New Timesheet</h1>
        {/* TimesheetSubmissionForm is a Client Component, which is fine here */}
        <TimesheetSubmissionForm />
      </div>
    </div>
  );
} 