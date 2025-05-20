"use client";

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, CalendarIcon, ClockIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { clientRPC } from '@/lib/client-rpc';
import { timesheetCreateSchema, type TimesheetCreate } from '@/server/validations/timesheet.schema';
import type { Truck } from '@/server/validations/truck.schema'; // Assuming this type is defined
import {
  dateTimeLocalStringToTimestampSeconds,
  timestampSecondsToDateTimeLocalString,
} from '@/lib/date-utils';

// Helper to convert datetime-local string to UNIX timestamp (seconds)
// const dateTimeLocalToTimestamp = (dateTimeLocalString: string): number | undefined => {
//   if (!dateTimeLocalString) return undefined;
//   return Math.floor(new Date(dateTimeLocalString).getTime() / 1000);
// };

// Helper to convert UNIX timestamp (seconds) to datetime-local string
// const timestampToDateTimeLocal = (timestamp?: number | null): string => {
//   if (timestamp === null || timestamp === undefined) return '';
//   // Multiply by 1000 to convert seconds to milliseconds for Date constructor
//   // Format: YYYY-MM-DDTHH:mm
//   const date = new Date(timestamp * 1000);
//   const year = date.getFullYear();
//   const month = (date.getMonth() + 1).toString().padStart(2, '0');
//   const day = date.getDate().toString().padStart(2, '0');
//   const hours = date.getHours().toString().padStart(2, '0');
//   const minutes = date.getMinutes().toString().padStart(2, '0');
//   return `${year}-${month}-${day}T${hours}:${minutes}`;
// };

export function TimesheetSubmissionForm() {
  const queryClient = useQueryClient();
  const [selectedTruckId, setSelectedTruckId] = useState<string | undefined>(undefined);

  const form = useForm<TimesheetCreate>({
    resolver: zodResolver(timesheetCreateSchema),
    defaultValues: {
      truckId: '',
      shiftStartDate: undefined, // Will be number (timestamp)
      shiftEndDate: undefined, // Will be number (timestamp) or null
      startOdometerReading: undefined,
      endOdometerReading: undefined,
      notes: '',
    },
  });

  const { data: trucksData, isLoading: isLoadingTrucks, error: trucksError } = useQuery<Truck[], Error>({
    queryKey: ['trucks'],
    queryFn: async () => {
      const response = await clientRPC.api.trucks.$get();
      if (!response.ok) {
        let errorMessage = 'Failed to fetch trucks';
        try {
          const errorBody = await response.json();
          if (typeof errorBody === 'object' && errorBody !== null && 'error' in errorBody && typeof errorBody.error === 'string') {
            errorMessage = errorBody.error;
          } else if (response.statusText) {
            errorMessage = response.statusText;
          }
        } catch (e) {
          // Failed to parse JSON body, or other error
          errorMessage = response.statusText || 'Failed to fetch trucks and parse error response';
        }
        throw new Error(errorMessage);
      }
      return response.json() as Promise<Truck[]>;
    },
  });

  const selectedTruck = trucksData?.find(truck => truck.id === selectedTruckId);

  useEffect(() => {
    if (selectedTruck && selectedTruck.lastOdometerReading !== null && selectedTruck.lastOdometerReading !== undefined) {
      form.setValue('startOdometerReading', selectedTruck.lastOdometerReading, { shouldValidate: true });
    } else if (selectedTruckId === '' || !selectedTruckId) { // Truck deselected or selection cleared
        form.resetField('startOdometerReading');
    }
    // If selectedTruckId is defined, but the truck has no lastOdometerReading, 
    // we don't explicitly clear it here, allowing manual input or previously entered value to persist.
    // The form.resetField above handles the explicit deselection.
  }, [selectedTruck, selectedTruckId, form]);

  const createTimesheetMutation = useMutation<any, Error, TimesheetCreate>({
    mutationFn: async (data: TimesheetCreate) => {
      const response = await clientRPC.api.timesheets.$post({ json: data });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to submit timesheet and parse error' }));
        throw new Error(errorData.error || 'Failed to submit timesheet');
      }
      return response.json();
    },
    onSuccess: () => {
      toast.success('Timesheet submitted successfully!');
      queryClient.invalidateQueries({ queryKey: ['timesheets'] }); // For lists of timesheets
      queryClient.invalidateQueries({ queryKey: ['trucks', selectedTruckId] }); // To refresh selected truck details if shown elsewhere
      queryClient.invalidateQueries({ queryKey: ['trucks'] }); // To refresh truck list if odometer updated there
      form.reset({
        truckId: '',
        shiftStartDate: undefined,
        shiftEndDate: undefined,
        startOdometerReading: undefined,
        endOdometerReading: undefined,
        notes: '',
      });
      setSelectedTruckId(undefined);
    },
    onError: (error: Error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  function onSubmit(values: z.infer<typeof timesheetCreateSchema>) {
    createTimesheetMutation.mutate(values);
  }

  if (isLoadingTrucks) {
    return <div className="flex items-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading truck data...</div>;
  }

  if (trucksError) {
    return <div className="text-red-500">Error loading trucks: {trucksError.message}</div>;
  }
  
  if (!trucksData) {
    return <div className="text-red-500">No truck data available.</div>;
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="truckId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Truck*</FormLabel>
              <Select 
                onValueChange={(value) => {
                  field.onChange(value);
                  setSelectedTruckId(value);
                }}
                value={field.value}
                disabled={createTimesheetMutation.isPending}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a truck" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {trucksData.map((truck) => (
                    <SelectItem key={truck.id} value={truck.id}>
                      {truck.unitNumber} ({truck.make} {truck.model})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="shiftStartDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Shift Start Date & Time*</FormLabel>
              <FormControl>
                 {/* Use type="datetime-local" and manage conversion in submit and for display */}
                <Input 
                  type="datetime-local" 
                  value={timestampSecondsToDateTimeLocalString(field.value)}
                  onChange={(e) => {
                    const ts = dateTimeLocalStringToTimestampSeconds(e.target.value);
                    field.onChange(ts);
                  }}
                  disabled={createTimesheetMutation.isPending}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="shiftEndDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Shift End Date & Time</FormLabel>
              <FormControl>
                <Input 
                  type="datetime-local" 
                  value={timestampSecondsToDateTimeLocalString(field.value)}
                  onChange={(e) => {
                    const ts = dateTimeLocalStringToTimestampSeconds(e.target.value);
                    field.onChange(ts === undefined ? null : ts); // Allow clearing to null
                  }}
                  disabled={createTimesheetMutation.isPending}
                />
              </FormControl>
               <FormDescription>
                Leave blank if the shift is ongoing or to be ended later.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="startOdometerReading"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Start Odometer Reading (km)*</FormLabel>
              <FormControl>
                <Input 
                  type="number" 
                  placeholder="Enter start odometer reading" 
                  {...field}
                  onChange={e => field.onChange(e.target.value === '' ? undefined : parseInt(e.target.value, 10))}
                  value={field.value === undefined ? '' : field.value}
                  disabled={createTimesheetMutation.isPending}
                  min="0"
                />
              </FormControl>
              {selectedTruck?.lastOdometerReading !== null && selectedTruck?.lastOdometerReading !== undefined && (
                <FormDescription>
                  Selected truck's last known odometer: {selectedTruck.lastOdometerReading.toLocaleString()} km.
                </FormDescription>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="endOdometerReading"
          render={({ field }) => (
            <FormItem>
              <FormLabel>End Odometer Reading (km)*</FormLabel>
              <FormControl>
                <Input 
                  type="number" 
                  placeholder="Enter end odometer reading" 
                  {...field}
                  onChange={e => field.onChange(e.target.value === '' ? undefined : parseInt(e.target.value, 10))}
                  value={field.value === undefined ? '' : field.value}
                  disabled={createTimesheetMutation.isPending}
                  min="0"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Enter any notes for this timesheet (optional)"
                  {...field}
                  value={field.value ?? ''} // Ensure value is not null/undefined for Textarea
                  disabled={createTimesheetMutation.isPending}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={createTimesheetMutation.isPending || isLoadingTrucks}>
          {createTimesheetMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Submit Timesheet
        </Button>
      </form>
    </Form>
  );
} 