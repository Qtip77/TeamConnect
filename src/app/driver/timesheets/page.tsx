'use client';

import React, { useEffect, useState } from 'react';
import { TimesheetTable, type CurrentUser } from '@/components/timesheet-table';
import { requireDriver } from '@/lib/auth-utils';
import { Loader2 } from 'lucide-react';


export default function DriverTimesheetsPage() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUserAndCheckRole() {
      try {
        const session = await requireDriver(); // Handles redirection if not a driver
        if (session && session.user) {
          // Ensure the role from session.user is compatible with CurrentUser.role
          const userRole = session.user.role as CurrentUser['role'];
          if (!['driver', 'admin', 'maintenance'].includes(userRole)) {
            // This case should ideally be handled by requireDriver redirecting,
            // but as a fallback:
            console.warn('User has an unexpected role:', userRole);
            setError('Access denied due to unexpected user role.');
            // Potentially redirect here if requireDriver didn't, or show error
            // For now, we'll rely on requireDriver to have redirected.
            // If requireDriver allows non-driver roles through, this check is important.
          }
          setCurrentUser({
            id: session.user.id,
            role: userRole,
          });
        } else {
          // This case should also ideally be handled by requireDriver (e.g., redirecting to login)
          setError('Failed to retrieve user session.');
        }
      } catch (err: any) {
        console.error('Error in requireDriver:', err);
        // If requireDriver throws (e.g., due to redirect), this might not be hit
        // or it might be an actual error during session check.
        setError(err.message || 'An error occurred while verifying authentication.');
      } finally {
        setIsLoading(false);
      }
    }

    fetchUserAndCheckRole();
  }, []);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin mr-2" />
        <span>Loading your timesheets...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen text-red-500">
        <p>Error: {error}</p>
        <p>You might be redirected, or please try logging in again.</p>
      </div>
    );
  }

  if (!currentUser) {
    // This state should ideally not be reached if requireDriver handles redirection correctly
    // or if error state is set.
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p>Could not load user data. You may be redirected shortly.</p>
      </div>
    );
  }

  // At this point, currentUser should be valid and have the 'driver' role (or admin if they access this page)
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8 text-center">My Timesheets</h1>
      <TimesheetTable currentUser={currentUser} />
    </div>
  );
} 