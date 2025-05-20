"use client";

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Plus, Edit, Trash2, CheckCircle, XCircle } from 'lucide-react';
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
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';

// Import client RPC
import { clientRPC } from '@/lib/client-rpc';

// Import schemas and types
import {
  type Timesheet,
  type TimesheetCreate,
  type TimesheetUpdate,
  timesheetUpdateSchema,
} from '@/server/validations/timesheet.schema';
import { type Truck } from '@/server/validations/truck.schema';
import {
  type BillingRate,
} from '@/server/validations/timesheet.schema';

import {
  formatDateForDisplay,
  timestampSecondsToDateTimeLocalString,
  dateTimeLocalStringToTimestampSeconds,
  dateToTimestampSeconds,
} from '@/lib/date-utils';

// Define interfaces for component props and data structures
export interface CurrentUser {
  id: string;
  role: 'driver' | 'admin' | 'maintenance';
}

export interface FrontendTimesheet extends Timesheet {
  driver?: { id: string; name?: string | null; email?: string | null };
  truck?: { id: string; unitNumber?: string | null };
  approver?: { name?: string | null };
  rejectionReason: string | null;
  billingRateId: string | null;
  totalBilledAmount: number | null;
}

interface TimesheetsAdminProps {
  currentUser: CurrentUser;
}

const DEFAULT_LIMIT = 10;

export function TimesheetsAdmin({ currentUser }: TimesheetsAdminProps) {
  const queryClient = useQueryClient();

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(DEFAULT_LIMIT);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
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

  // Fetch Billing Rates for dropdown
  const { data: billingRatesData, isLoading: isLoadingBillingRates } = useQuery<BillingRate[]>({
    queryKey: ['billingRates'],
    queryFn: async () => {
      const response = await clientRPC.api.billingRates.$get();
      if (!response.ok) throw new Error('Failed to fetch billing rates');
      return response.json();
    },
    onError: (error) => {
      console.error('Error fetching billing rates:', error);
      return []; // Return empty array if the endpoint doesn't exist yet
    }
  });

  // Form for editing
  const editForm = useForm<TimesheetUpdate>({
    resolver: zodResolver(timesheetUpdateSchema),
    // Default values will be set when opening the dialog
  });

  const timesheetsQueryKey = ['timesheets', 'admin', currentPage, limit];

  const { data: timesheetsResponse, isLoading: isLoadingTimesheets, error: timesheetsError } = useQuery<{ data: FrontendTimesheet[], total: number }>({
    queryKey: timesheetsQueryKey,
    queryFn: async () => {
      // Get all timesheets as admin
      const response = await clientRPC.api.timesheets.$get();
      if (!response.ok) {
        let errorMessage = 'Failed to fetch timesheets';
        try {
          const errorPayload = await response.json();
          if (typeof errorPayload === 'object' && errorPayload !== null && 'error' in errorPayload && typeof errorPayload.error === 'string') {
            errorMessage = errorPayload.error;
          }
        } catch (e) {
          errorMessage = response.statusText || 'Failed to fetch timesheets and parse error response';
        }
        throw new Error(errorMessage);
      }
      const data = await response.json() as FrontendTimesheet[];
      return { data, total: data.length };
    },
  });
  
  const timesheets = timesheetsResponse?.data || [];
  const totalTimesheets = timesheetsResponse?.total || 0;

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

  const deleteTimesheetMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await clientRPC.api.timesheets[":id"].$delete({
        param: { id },
      });
      if (!response.ok) {
        let errorMessage = 'Failed to delete timesheet';
        try {
          const errorPayload = await response.json();
          if (typeof errorPayload === 'object' && errorPayload !== null && 'error' in errorPayload && typeof errorPayload.error === 'string') {
            errorMessage = errorPayload.error;
          }
        } catch (e) {
          errorMessage = response.statusText || 'Failed to delete timesheet and parse error response';
        }
        throw new Error(errorMessage);
      }
      return response.json();
    },
    onSuccess: () => {
      toast.success('Timesheet deleted successfully');
      queryClient.invalidateQueries({ queryKey: timesheetsQueryKey });
      setDeleteDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete timesheet');
    },
  });

  const handleDeleteTimesheet = (timesheet: FrontendTimesheet) => {
    setSelectedTimesheet(timesheet);
    setDeleteDialogOpen(true);
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

  const onEditSubmit = (values: TimesheetUpdate) => {
    if (!selectedTimesheet) return;
    updateTimesheetMutation.mutate({ id: selectedTimesheet.id, data: values });
  };

  const onDeleteConfirm = () => {
    if (!selectedTimesheet) return;
    deleteTimesheetMutation.mutate(selectedTimesheet.id);
  };

  const handleQuickApprove = (timesheet: FrontendTimesheet) => {
    updateTimesheetMutation.mutate({
      id: timesheet.id,
      data: { status: "approved" }
    });
  };

  const handleQuickReject = (timesheet: FrontendTimesheet) => {
    // Open edit form with rejected status pre-selected
    setSelectedTimesheet(timesheet);
    editForm.reset({
      ...timesheet,
      status: "rejected",
      shiftStartDate: timesheet.shiftStartDate ? dateToTimestampSeconds(new Date(timesheet.shiftStartDate)) : undefined,
      shiftEndDate: timesheet.shiftEndDate ? dateToTimestampSeconds(new Date(timesheet.shiftEndDate)) : undefined,
    });
    setEditDialogOpen(true);
  };

  const paginatedTimesheets = timesheets.slice((currentPage - 1) * limit, currentPage * limit);
  const totalPages = Math.ceil(totalTimesheets / limit);

  const isMutating = updateTimesheetMutation.isPending || deleteTimesheetMutation.isPending;
  const isLoading = isLoadingTimesheets || isLoadingTrucks || isLoadingBillingRates;

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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500">Approved</Badge>;
      case 'rejected':
        return <Badge className="bg-red-500">Rejected</Badge>;
      case 'pending':
      default:
        return <Badge className="bg-yellow-500">Pending</Badge>;
    }
  };

  const commonDateFormField = (
    form: any, 
    name: keyof TimesheetUpdate, 
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
    name: keyof TimesheetUpdate,
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
    <div className="container mx-auto">
      {(isLoadingTimesheets && timesheetsResponse) && (
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
            <TableHead>Driver</TableHead>
            <TableHead>Truck</TableHead>
            <TableHead>Shift Start</TableHead>
            <TableHead>Shift End</TableHead>
            <TableHead>Start Odometer</TableHead>
            <TableHead>End Odometer</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Notes</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedTimesheets.length > 0 ? (
            paginatedTimesheets.map((timesheet) => (
              <TableRow key={timesheet.id}>
                <TableCell>{timesheet.driver?.name || timesheet.driver?.email || 'Unknown'}</TableCell>
                <TableCell>{timesheet.truck?.unitNumber || 'N/A'}</TableCell>
                <TableCell>{formatDateForDisplay(timesheet.shiftStartDate)}</TableCell>
                <TableCell>{formatDateForDisplay(timesheet.shiftEndDate)}</TableCell>
                <TableCell>{timesheet.startOdometerReading?.toLocaleString() ?? 'N/A'}</TableCell>
                <TableCell>{timesheet.endOdometerReading?.toLocaleString() ?? 'N/A'}</TableCell>
                <TableCell>{getStatusBadge(timesheet.status || 'pending')}</TableCell>
                <TableCell className="max-w-xs truncate">{timesheet.notes || 'N/A'}</TableCell>
                <TableCell>
                  <div className="flex space-x-1">
                    {timesheet.status === 'pending' && (
                      <>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleQuickApprove(timesheet)}
                          disabled={isMutating}
                          title="Approve"
                        >
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleQuickReject(timesheet)}
                          disabled={isMutating}
                          title="Reject"
                        >
                          <XCircle className="h-4 w-4 text-red-500" />
                        </Button>
                      </>
                    )}
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleEditTimesheet(timesheet)}
                      disabled={isMutating}
                      title="Edit"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleDeleteTimesheet(timesheet)}
                      disabled={isMutating}
                      title="Delete"
                      className="text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
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

      {/* Edit Timesheet Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[625px]">
          <DialogHeader>
            <DialogTitle>Edit Timesheet</DialogTitle>
            <DialogDescription>
              Update details for timesheet ID: {selectedTimesheet?.id}.
              {selectedTimesheet?.driver?.name ? ` Driver: ${selectedTimesheet.driver.name}` : ''}
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
                        <Input placeholder="Enter any notes" {...field} value={field.value ?? ""} disabled={isMutating} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status*</FormLabel>
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
                      <FormDescription>
                        Required if status is "rejected"
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="billingRateId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Billing Rate</FormLabel>
                      <Select 
                        onValueChange={(value) => field.onChange(value === "null" ? null : value)} 
                        defaultValue={field.value ?? "null"}
                        disabled={isMutating || isLoadingBillingRates}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select billing rate" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="null">None</SelectItem>
                          {billingRatesData?.map(rate => (
                            <SelectItem key={rate.id} value={rate.id}>
                              {rate.rateName} - {rate.ratePerHour}/{rate.currency}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {commonNumberFormField(editForm, "totalBilledAmount", "Total Billed Amount", false, 0)}
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)} disabled={isMutating}>Cancel</Button>
                  <Button type="submit" disabled={isMutating || updateTimesheetMutation.isPending}>
                    {updateTimesheetMutation.isPending && <Loader2 size={16} className="animate-spin mr-1" />}
                    Update Timesheet
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Timesheet</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this timesheet?
              <div className="mt-2 p-3 bg-gray-100 rounded-md">
                <p><strong>Driver:</strong> {selectedTimesheet?.driver?.name || selectedTimesheet?.driver?.email || 'Unknown'}</p>
                <p><strong>Date:</strong> {selectedTimesheet ? formatDateForDisplay(selectedTimesheet.shiftStartDate) : 'N/A'}</p>
                <p><strong>Truck:</strong> {selectedTimesheet?.truck?.unitNumber || 'N/A'}</p>
              </div>
              <p className="mt-2 text-red-500">This action cannot be undone.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteTimesheetMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDeleteConfirm}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              disabled={deleteTimesheetMutation.isPending}
            >
              {deleteTimesheetMutation.isPending && <Loader2 size={16} className="animate-spin mr-1" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
} 