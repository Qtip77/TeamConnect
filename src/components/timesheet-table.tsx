"use client";

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Plus, Edit, Trash2 } from 'lucide-react'; // Assuming Trash2 might be for admin later
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

// Import UI components
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"; // Assuming Select component exists

// Import client RPC
import { clientRPC } from '@/lib/client-rpc';

// Import schemas and types
import {
  type Timesheet,
  type TimesheetCreate,
  type TimesheetUpdate,
  timesheetCreateSchema,
  timesheetUpdateSchema,
} from '@/server/validations/timesheet.schema';
import { type Truck } from '@/server/validations/truck.schema';
import {
  formatDateForDisplay,
  timestampSecondsToDateTimeLocalString,
  dateTimeLocalStringToTimestampSeconds,
  dateToTimestampSeconds,
} from '@/lib/date-utils';


// Define interfaces for component props and data structures
export interface CurrentUser {
  id: string;
  role: 'driver' | 'admin' | 'maintenance'; // Add other roles if necessary
}

export interface FrontendTimesheet extends Timesheet {
  driver?: { id: string; name?: string | null; email?: string | null };
  truck?: { id: string; unitNumber?: string | null }; // Added truck.id for consistency
  approver?: { name?: string | null };
  // Ensure these match the base Timesheet type if non-optional, or are compatible.
  rejectionReason: string | null; // Ensuring non-optional if base is string | null
  billingRateId: string | null;   // Ensuring non-optional if base is string | null
  totalBilledAmount: number | null; // Ensuring non-optional if base is number | null
}

interface TimesheetTableProps {
  currentUser: CurrentUser;
}

const DEFAULT_LIMIT = 10;

// Helper to format date for display
// const formatDateDisplay = (isoOrTimestamp?: string | number | Date | null): string => {
//   if (!isoOrTimestamp) return 'N/A';
//   try {
//     const date = new Date(isoOrTimestamp);
//     // Check if date is valid after parsing
//     if (isNaN(date.getTime())) return 'Invalid Date';
//     return date.toLocaleString();
//   } catch (e) {
//     return 'Invalid Date';
//   }
// };

// Helper to convert date to YYYY-MM-DDTHH:mm for datetime-local input
// const formatForDateTimeLocalInput = (dateValue?: string | number | Date | null): string => {
//   if (!dateValue) return '';
//   try {
//     const date = new Date(dateValue);
//     if (isNaN(date.getTime())) return '';
//     //toISOString returns YYYY-MM-DDTHH:mm:ss.sssZ, slice to get YYYY-MM-DDTHH:mm
//     return date.toISOString().slice(0, 16);
//   } catch (e) {
//     return '';
//   }
// };

// Helper to convert datetime-local string to timestamp in seconds
// const dateTimeLocalToTimestampSeconds = (dateTimeLocalString?: string): number | undefined => {
//   if (!dateTimeLocalString) return undefined;
//   try {
//     const date = new Date(dateTimeLocalString);
//     if (isNaN(date.getTime())) return undefined;
//     return Math.floor(date.getTime() / 1000);
//   } catch (e) {
//     return undefined;
//   }
// };


export function TimesheetTable({ currentUser }: TimesheetTableProps) {
  const queryClient = useQueryClient();

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(DEFAULT_LIMIT);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedTimesheet, setSelectedTimesheet] = useState<FrontendTimesheet | null>(null);

  // Fetch Trucks for dropdown
  const { data: trucksData, isLoading: isLoadingTrucks } = useQuery<Truck[]>({
    queryKey: ['trucks'],
    queryFn: async () => {
      const response = await clientRPC.api.trucks.$get();
      if (!response.ok) throw new Error('Failed to fetch trucks');
      return response.json();
    },
  });

  // Forms
  const createForm = useForm<TimesheetCreate>({
    resolver: zodResolver(timesheetCreateSchema),
    defaultValues: {
      truckId: undefined,
      shiftStartDate: undefined, // Will be number (timestamp in seconds)
      shiftEndDate: undefined,   // Will be number (timestamp in seconds)
      startOdometerReading: 0,
      endOdometerReading: undefined,
      notes: '',
    },
  });

  const editForm = useForm<TimesheetUpdate>({
    resolver: zodResolver(timesheetUpdateSchema),
    // Default values will be set when opening the dialog
  });

  const timesheetsQueryKey = ['timesheets', currentUser.id, currentUser.role, currentPage, limit];

  const { data: timesheetsResponse, isLoading: isLoadingTimesheets, error: timesheetsError } = useQuery<{ data: FrontendTimesheet[], total: number }>({
    queryKey: timesheetsQueryKey,
    queryFn: async () => {
      // Note: The backend GET /timesheets route as provided returns an array directly.
      // If it were to return { data: [], total: number } then this is fine.
      // For now, assuming it returns Array<FrontendTimesheet> and we derive total.
      // The API doesn't seem to support pagination server-side from the provided Hono route.
      // The example TruckTable did client-side pagination. Let's follow that.
      const response = await clientRPC.api.timesheets.$get(); // Add query params if API supports: { query: { page: currentPage.toString(), limit: limit.toString() } }
      if (!response.ok) {
        let errorMessage = 'Failed to fetch timesheets';
        try {
          const errorPayload = await response.json();
          if (typeof errorPayload === 'object' && errorPayload !== null && 'error' in errorPayload && typeof errorPayload.error === 'string') {
            errorMessage = errorPayload.error;
          }
        } catch (e) {
          // JSON parsing failed, use default or status text
          errorMessage = response.statusText || 'Failed to fetch timesheets and parse error response';
        }
        throw new Error(errorMessage);
      }
      const data = await response.json() as FrontendTimesheet[];
      return { data, total: data.length }; // Simulating total for client-side pagination
    },
  });
  
  const timesheets = timesheetsResponse?.data || [];
  const totalTimesheets = timesheetsResponse?.total || 0;


  const createTimesheetMutation = useMutation({
    mutationFn: async (data: TimesheetCreate) => {
      const response = await clientRPC.api.timesheets.$post({ json: data });
      if (!response.ok) {
        let errorMessage = 'Failed to create timesheet';
        try {
          const errorPayload = await response.json();
          if (typeof errorPayload === 'object' && errorPayload !== null && 'error' in errorPayload && typeof errorPayload.error === 'string') {
            errorMessage = errorPayload.error;
          }
        } catch (e) {
          errorMessage = response.statusText || 'Failed to create timesheet and parse error response';
        }
        throw new Error(errorMessage);
      }
      return response.json() as Promise<FrontendTimesheet>;
    },
    onSuccess: () => {
      toast.success('Timesheet created successfully');
      queryClient.invalidateQueries({ queryKey: timesheetsQueryKey });
      setCreateDialogOpen(false);
      createForm.reset();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create timesheet');
    },
  });

  const updateTimesheetMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: TimesheetUpdate }) => {
      const response = await clientRPC.api.timesheets[":id"].$patch({
        param: { id },
        json: data,
      });
      if (!response.ok) {
        let errorMessage = 'Failed to update timesheet';
        try {
          const errorPayload = await response.json();
          if (typeof errorPayload === 'object' && errorPayload !== null && 'error' in errorPayload && typeof errorPayload.error === 'string') {
            errorMessage = errorPayload.error;
          }
        } catch (e) {
          errorMessage = response.statusText || 'Failed to update timesheet and parse error response';
        }
        throw new Error(errorMessage);
      }
      return response.json() as Promise<FrontendTimesheet>;
    },
    onSuccess: () => {
      toast.success('Timesheet updated successfully');
      queryClient.invalidateQueries({ queryKey: timesheetsQueryKey });
      setEditDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update timesheet');
    },
  });


  const handleCreateTimesheet = () => {
    createForm.reset({
      truckId: undefined,
      shiftStartDate: undefined,
      shiftEndDate: undefined,
      startOdometerReading: 0,
      endOdometerReading: undefined,
      notes: '',
    });
    setCreateDialogOpen(true);
  };

  const handleEditTimesheet = (timesheet: FrontendTimesheet) => {
    setSelectedTimesheet(timesheet);
    editForm.reset({
      truckId: timesheet.truckId || undefined,
      shiftStartDate: timesheet.shiftStartDate ? dateToTimestampSeconds(new Date(timesheet.shiftStartDate)) : undefined,
      shiftEndDate: timesheet.shiftEndDate ? dateToTimestampSeconds(new Date(timesheet.shiftEndDate)) : undefined,
      startOdometerReading: timesheet.startOdometerReading ?? undefined,
      endOdometerReading: timesheet.endOdometerReading ?? undefined,
      notes: timesheet.notes ?? undefined,
      status: timesheet.status as "pending" | "approved" | "rejected" | undefined,
      rejectionReason: timesheet.rejectionReason ?? undefined,
      billingRateId: timesheet.billingRateId ?? undefined,
      totalBilledAmount: timesheet.totalBilledAmount ?? undefined,
    });
    setEditDialogOpen(true);
  };
  
  const onCreateSubmit = (values: TimesheetCreate) => {
    // Values already in correct format (numbers for dates) due to form field onChange handlers
    createTimesheetMutation.mutate(values);
  };

  const onEditSubmit = (values: TimesheetUpdate) => {
    if (!selectedTimesheet) return;
    // Values already in correct format
    updateTimesheetMutation.mutate({ id: selectedTimesheet.id, data: values });
  };

  const canEdit = (timesheet: FrontendTimesheet): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') {
      return true; 
    }
    if (currentUser.role === 'driver') {
      // Ensure timesheet.driver is populated or use timesheet.driverId
      const driverId = timesheet.driver?.id || timesheet.driverId;
      return driverId === currentUser.id &&
             (timesheet.status === 'pending' || timesheet.status === 'rejected');
    }
    return false;
  };

  const paginatedTimesheets = timesheets.slice((currentPage - 1) * limit, currentPage * limit);
  const totalPages = Math.ceil(totalTimesheets / limit);

  const isMutating = createTimesheetMutation.isPending || updateTimesheetMutation.isPending;
  const isLoading = isLoadingTimesheets || isLoadingTrucks;


  if (isLoading && !timesheetsResponse && !trucksData) {
    return (
      <div className="flex justify-center items-center p-10">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        <span>Loading data...</span>
      </div>
    );
  }

  if (timesheetsError) {
    return (
      <div className="text-red-500 p-5 border border-red-500 rounded-md bg-red-50">
        Error loading timesheets: {(timesheetsError as Error).message}
      </div>
    );
  }
  
  const commonDateFormField = (
    form: any, 
    name: keyof TimesheetCreate | keyof TimesheetUpdate, 
    label: string, 
    required: boolean = true
  ) => (
    <FormField
      control={form.control}
      name={name as string}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}{required ? '*' : ''}</FormLabel>
          <FormControl>
            <Input
              type="datetime-local"
              value={field.value ? timestampSecondsToDateTimeLocalString(field.value) : ''}
              onChange={(e) => field.onChange(dateTimeLocalStringToTimestampSeconds(e.target.value))}
              disabled={isMutating}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
  
  const commonNumberFormField = (
    form: any,
    name: keyof TimesheetCreate | keyof TimesheetUpdate,
    label: string,
    required: boolean = true,
    min?: number,
    placeholder?: string
  ) => (
    <FormField
      control={form.control}
      name={name as string}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}{required ? '*' : ''}</FormLabel>
          <FormControl>
            <Input
              type="number"
              placeholder={placeholder}
              min={min}
              {...field}
              value={field.value === null || field.value === undefined ? "" : field.value}
              onChange={(e) => {
                const val = e.target.value;
                field.onChange(val === "" ? null : parseInt(val, 10));
              }}
              disabled={isMutating}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );


  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Timesheet Management</h1>
        {(currentUser.role === 'driver') && (
          <Button onClick={handleCreateTimesheet} disabled={isMutating || isLoadingTrucks}>
            <Plus className="mr-2 h-4 w-4" />
            Add New Timesheet
          </Button>
        )}
      </div>

      {(isLoadingTimesheets && timesheetsResponse) && ( // Show subtle loading when refetching
        <div className="flex items-center mb-4 text-sm text-muted-foreground">
          <Loader2 size={16} className="animate-spin mr-2" /> 
          <span>Updating...</span>
        </div>
      )}
      
      {isMutating && (
        <div className="flex items-center mb-4 text-sm text-muted-foreground">
          <Loader2 size={16} className="animate-spin mr-2" /> 
          <span>Processing action...</span>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Truck</TableHead>
            <TableHead>Shift Start</TableHead>
            <TableHead>Shift End</TableHead>
            <TableHead>Start Odometer</TableHead>
            <TableHead>End Odometer</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Driver</TableHead>
            <TableHead>Notes</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedTimesheets.length > 0 ? (
            paginatedTimesheets.map((timesheet) => (
              <TableRow key={timesheet.id}>
                <TableCell>{timesheet.truck?.unitNumber || 'N/A'}</TableCell>
                <TableCell>{formatDateForDisplay(timesheet.shiftStartDate)}</TableCell>
                <TableCell>{formatDateForDisplay(timesheet.shiftEndDate)}</TableCell>
                <TableCell>{timesheet.startOdometerReading?.toLocaleString() ?? 'N/A'}</TableCell>
                <TableCell>{timesheet.endOdometerReading?.toLocaleString() ?? 'N/A'}</TableCell>
                <TableCell>{timesheet.status || 'N/A'}</TableCell>
                <TableCell>{timesheet.driver?.name || timesheet.driver?.email || (timesheet.driverId === currentUser.id ? 'Me' : 'N/A')}</TableCell>
                <TableCell className="max-w-xs truncate">{timesheet.notes || 'N/A'}</TableCell>
                <TableCell>
                  {canEdit(timesheet) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditTimesheet(timesheet)}
                      disabled={isMutating}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={9} className="text-center py-6">
                No timesheets found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {totalTimesheets > 0 && totalPages > 1 && (
         <div className="flex justify-between items-center mt-6">
            <Pagination>
                <PaginationContent>
                <PaginationItem>
                    <PaginationPrevious
                    onClick={() => currentPage > 1 && !isLoading && !isMutating ?
                        setCurrentPage((prev) => Math.max(1, prev - 1)) : undefined}
                    className={(currentPage === 1 || isLoading || isMutating) ?
                        "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                </PaginationItem>
                {[...Array(totalPages).keys()].map(num => (
                    <PaginationItem key={num}>
                    <PaginationLink
                        onClick={() => !isLoading && !isMutating ? setCurrentPage(num + 1) : undefined}
                        isActive={currentPage === num + 1}
                        className={(isLoading || isMutating) && currentPage !== num + 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    >
                        {num + 1}
                    </PaginationLink>
                    </PaginationItem>
                ))}
                <PaginationItem>
                    <PaginationNext
                    onClick={() => currentPage < totalPages && !isLoading && !isMutating ?
                        setCurrentPage((prev) => Math.min(totalPages, prev + 1)) : undefined}
                    className={(currentPage >= totalPages || isLoading || isMutating) ?
                        "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                </PaginationItem>
                </PaginationContent>
            </Pagination>
            <div className="flex items-center space-x-2 text-sm">
                <span>Rows per page:</span>
                <Select
                    value={limit.toString()}
                    onValueChange={(value) => {
                        setLimit(Number(value));
                        setCurrentPage(1); // Reset to first page
                    }}
                    disabled={isLoading || isMutating}
                >
                    <SelectTrigger className="w-[70px]">
                        <SelectValue placeholder={limit} />
                    </SelectTrigger>
                    <SelectContent>
                        {[5, 10, 20, 50].map(val => (
                            <SelectItem key={val} value={val.toString()}>{val}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <span className="ml-2">
                Total: {totalTimesheets}
                </span>
            </div>
        </div>
      )}

      {/* Create Timesheet Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Timesheet</DialogTitle>
            <DialogDescription>
              Fill in the details for your new timesheet.
            </DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
              <FormField
                control={createForm.control}
                name="truckId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Truck*</FormLabel>
                    <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value} 
                        disabled={isMutating || isLoadingTrucks}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={isLoadingTrucks ? "Loading trucks..." : "Select a truck"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {trucksData?.map(truck => (
                          <SelectItem key={truck.id} value={truck.id}>
                            {truck.unitNumber} - {truck.make} {truck.model}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {commonDateFormField(createForm, "shiftStartDate", "Shift Start Date", true)}
              {commonDateFormField(createForm, "shiftEndDate", "Shift End Date", true)}
              {commonNumberFormField(createForm, "startOdometerReading", "Start Odometer Reading (km)", true, 0, "e.g., 12345")}
              {commonNumberFormField(createForm, "endOdometerReading", "End Odometer Reading (km)", true, 0, "e.g., 12400")}
              <FormField
                control={createForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter any notes (optional)" {...field} value={field.value ?? ""} disabled={isMutating}/>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)} disabled={isMutating}>Cancel</Button>
                <Button type="submit" disabled={isMutating || isLoadingTrucks || createTimesheetMutation.isPending}>
                  {(createTimesheetMutation.isPending) && <Loader2 size={16} className="animate-spin mr-1" />}
                  Add Timesheet
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Timesheet Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[625px]">
          <DialogHeader>
            <DialogTitle>Edit Timesheet</DialogTitle>
            <DialogDescription>
              Update details for timesheet ID: {selectedTimesheet?.id}.
              Current status: {selectedTimesheet?.status}
            </DialogDescription>
          </DialogHeader>
          {selectedTimesheet && (
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
                <FormField
                  control={editForm.control}
                  name="truckId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Truck*</FormLabel>
                       <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                        disabled={isMutating || isLoadingTrucks || (currentUser.role === 'driver' && !canEdit(selectedTimesheet))}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={isLoadingTrucks ? "Loading trucks..." : "Select a truck"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {trucksData?.map(truck => (
                            <SelectItem key={truck.id} value={truck.id}>
                              {truck.unitNumber} - {truck.make} {truck.model}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {commonDateFormField(editForm, "shiftStartDate", "Shift Start Date", true)}
                {commonDateFormField(editForm, "shiftEndDate", "Shift End Date", true)}
                {commonNumberFormField(editForm, "startOdometerReading", "Start Odometer Reading (km)", true, 0)}
                {commonNumberFormField(editForm, "endOdometerReading", "End Odometer Reading (km)", true, 0)}
                 <FormField
                  control={editForm.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter any notes" {...field} value={field.value ?? ""} disabled={isMutating || (currentUser.role === 'driver' && !canEdit(selectedTimesheet))} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Admin-specific fields */}
                {currentUser.role === 'admin' && (
                  <>
                    <FormField
                      control={editForm.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isMutating}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="approved">Approved</SelectItem>
                              <SelectItem value="rejected">Rejected</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="rejectionReason"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Rejection Reason</FormLabel>
                          <FormControl>
                            <Input placeholder="Reason for rejection (if applicable)" {...field} value={field.value ?? ""} disabled={isMutating}/>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="billingRateId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Billing Rate ID</FormLabel>
                          <FormControl>
                            {/* Ideally a select, but no data source for billing rates provided */}
                            <Input placeholder="Enter Billing Rate ID (CUID)" {...field} value={field.value ?? ""} disabled={isMutating}/>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {commonNumberFormField(editForm, "totalBilledAmount", "Total Billed Amount", false, 0)}
                  </>
                )}
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)} disabled={isMutating}>Cancel</Button>
                  <Button type="submit" disabled={isMutating || isLoadingTrucks || updateTimesheetMutation.isPending || (currentUser.role === 'driver' && !canEdit(selectedTimesheet))}>
                    {updateTimesheetMutation.isPending && <Loader2 size={16} className="animate-spin mr-1" />}
                    Update Timesheet
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

