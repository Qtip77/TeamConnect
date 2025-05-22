"use client";

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, Edit, CheckCircle, XCircle } from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

// Import client RPC
import { clientRPC } from '@/lib/client-rpc';

// Import billing rate schemas
import { 
  type BillingRate, 
  type BillingRateCreate, 
  type BillingRateUpdate,
  billingRateCreateSchema, 
  billingRateUpdateSchema 
} from '@/server/validations/timesheet.schema';

interface BillingRatesTableProps {
  isAdmin: boolean;
}

const DEFAULT_LIMIT = 10;
const CURRENCY_OPTIONS = ["USD", "CAD", "EUR", "GBP"];

export function BillingRatesTable({ isAdmin }: BillingRatesTableProps) {
  const queryClient = useQueryClient();

  // State for pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(DEFAULT_LIMIT);

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  // Currently selected billing rate for actions
  const [selectedRate, setSelectedRate] = useState<BillingRate | null>(null);

  // Forms for create and update operations
  const createForm = useForm<BillingRateCreate>({
    resolver: zodResolver(billingRateCreateSchema),
    defaultValues: {
      rateName: "",
      ratePerHour: 0,
      currency: "CAD",
      description: "",
      isActive: true,
    },
  });

  const editForm = useForm<BillingRateUpdate>({
    resolver: zodResolver(billingRateUpdateSchema),
    defaultValues: {
      rateName: "",
      ratePerHour: 0,
      currency: "USD",
      description: "",
      isActive: true,
    },
  });

  // Query key for the billing rates API
  const billingRatesQueryKey = ['billingRates', currentPage, limit];

  // Query to fetch billing rates
  const { data, isLoading, error } = useQuery({
    queryKey: billingRatesQueryKey,
    queryFn: async () => {
      try {
        const response = await clientRPC.api.billingRates.$get();
        return response.json() as Promise<BillingRate[]>;
      } catch (error) {
        console.error("Error fetching billing rates:", error);
        throw error;
      }
    },
    enabled: isAdmin, // Only fetch if user is admin
  });

  // Mutation to create a new billing rate
  const createBillingRateMutation = useMutation({
    mutationFn: async (data: BillingRateCreate) => {
      try {
        const response = await clientRPC.api.billingRates.$post({ json: data });
        
        if (!response.ok) {
          const errorData = await response.json() as { error: string };
          throw new Error(errorData.error || 'Failed to create billing rate');
        }
        
        return response.json() as Promise<BillingRate>;
      } catch (error) {
        console.error("Error creating billing rate:", error);
        throw error;
      }
    },
    onSuccess: () => {
      toast.success('Billing rate created successfully');
      queryClient.invalidateQueries({ queryKey: billingRatesQueryKey });
      setCreateDialogOpen(false);
      createForm.reset();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create billing rate');
    },
  });

  // Mutation to update a billing rate
  const updateBillingRateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: BillingRateUpdate }) => {
      try {
        const response = await clientRPC.api.billingRates[":id"].$patch({
          param: { id },
          json: data,
        });
        
        if (!response.ok) {
          const errorData = await response.json() as { error: string };
          throw new Error(errorData.error || 'Failed to update billing rate');
        }
        
        return response.json() as Promise<BillingRate>;
      } catch (error: any) {
        if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
          throw new Error('Network error: Unable to connect to the server');
        }
        throw error;
      }
    },
    onSuccess: () => {
      toast.success('Billing rate updated successfully');
      queryClient.invalidateQueries({ queryKey: billingRatesQueryKey });
      setEditDialogOpen(false);
    },
    onError: (error: any) => {
      if (error.message?.includes("Network error")) {
        toast.error(error.message);
        console.error("Network error when updating billing rate:", error);
      } else {
        toast.error(error.message || 'Failed to update billing rate');
      }
    },
  });

  // Mutation to delete a billing rate
  const deleteBillingRateMutation = useMutation({
    mutationFn: async (id: string) => {
      try {
        const response = await clientRPC.api.billingRates[":id"].$delete({
          param: { id },
        });
        
        if (!response.ok) {
          const errorData = await response.json() as { error: string };
          throw new Error(errorData.error || 'Failed to delete billing rate');
        }
        
        return response.json();
      } catch (error) {
        console.error("Error deleting billing rate:", error);
        throw error;
      }
    },
    onSuccess: () => {
      toast.success('Billing rate deleted successfully');
      queryClient.invalidateQueries({ queryKey: billingRatesQueryKey });
      setDeleteDialogOpen(false);
    },
    onError: (error: any) => {
      if (error.message?.includes("FOREIGN KEY constraint failed")) {
        toast.error("This billing rate is referenced by existing timesheets and cannot be deleted");
      } else {
        toast.error(error.message || 'Failed to delete billing rate');
      }
    },
  });

  // Handler to open create dialog
  const handleCreateRate = () => {
    createForm.reset({
      rateName: "",
      ratePerHour: 0,
      currency: "USD",
      description: "",
      isActive: true,
    });
    setCreateDialogOpen(true);
  };

  // Handler to open edit dialog
  const handleEditRate = (rate: BillingRate) => {
    setSelectedRate(rate);
    editForm.reset({
      rateName: rate.rateName,
      ratePerHour: rate.ratePerHour,
      currency: rate.currency,
      description: rate.description || "",
      isActive: rate.isActive || true,
    });
    setEditDialogOpen(true);
  };

  // Handler to open delete dialog
  const handleDeleteRate = (rate: BillingRate) => {
    setSelectedRate(rate);
    setDeleteDialogOpen(true);
  };

  // Handler to submit create form
  const onCreateSubmit = createForm.handleSubmit((values) => {
    createBillingRateMutation.mutate(values);
  });

  // Handler to submit edit form
  const onEditSubmit = editForm.handleSubmit((values) => {
    if (!selectedRate) return;
    updateBillingRateMutation.mutate({ id: selectedRate.id, data: values });
  });

  // Handler to confirm deletion
  const onDeleteConfirm = () => {
    if (!selectedRate) return;
    deleteBillingRateMutation.mutate(selectedRate.id);
  };

  // Calculate pagination
  const totalRates = data?.length || 0;
  const paginatedRates = data?.slice((currentPage - 1) * limit, currentPage * limit) || [];
  const totalPages = Math.ceil(totalRates / limit);

  // Determine if any mutation is in progress
  const isMutating =
    createBillingRateMutation.isPending ||
    updateBillingRateMutation.isPending ||
    deleteBillingRateMutation.isPending;

  // If not admin, show unauthorized message
  if (!isAdmin) {
    return (
      <div className="text-red-500 p-5 border border-red-500 rounded-md bg-red-50 my-8">
        You do not have permission to manage billing rates.
      </div>
    );
  }

  // Render loading state
  if (isLoading && !data) {
    return (
      <div className="flex justify-center items-center p-10">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        <span>Loading billing rates...</span>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="text-red-500 p-5 border border-red-500 rounded-md bg-red-50">
        Error loading billing rates: {(error as Error).message}
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Billing Rate Management</h1>
        <Button onClick={handleCreateRate} disabled={isMutating}>
          <Plus className="mr-2 h-4 w-4" />
          Add New Billing Rate
        </Button>
      </div>

      {/* Loading or mutation indicators */}
      {isLoading && data && (
        <div className="flex items-center mb-4">
          <Loader2 size={16} className="animate-spin mr-2" /> 
          <span>Updating...</span>
        </div>
      )}
      
      {isMutating && (
        <div className="flex items-center mb-4">
          <Loader2 size={16} className="animate-spin mr-2" /> 
          <span>Processing action...</span>
        </div>
      )}

      {/* Billing Rates table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Rate Name</TableHead>
            <TableHead>Rate Per Hour</TableHead>
            <TableHead>Currency</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedRates.length > 0 ? (
            paginatedRates.map((rate) => (
              <TableRow key={rate.id}>
                <TableCell>{rate.rateName}</TableCell>
                <TableCell>{rate.ratePerHour.toFixed(2)}</TableCell>
                <TableCell>{rate.currency}</TableCell>
                <TableCell>{rate.description || 'N/A'}</TableCell>
                <TableCell>
                  {rate.isActive ? (
                    <span className="flex items-center text-green-600">
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Active
                    </span>
                  ) : (
                    <span className="flex items-center text-red-600">
                      <XCircle className="h-4 w-4 mr-1" />
                      Inactive
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {new Date(rate.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <div className="flex space-x-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleEditRate(rate)}
                      disabled={isMutating}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteRate(rate)}
                      disabled={isMutating}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-6">
                No billing rates found
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* Pagination */}
      {totalRates > 0 && (
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
              
              {/* First page */}
              {currentPage > 2 && (
                <PaginationItem>
                  <PaginationLink 
                    onClick={() => !isLoading && !isMutating ? setCurrentPage(1) : undefined}
                    className={isLoading || isMutating ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  >
                    1
                  </PaginationLink>
                </PaginationItem>
              )}
              
              {/* Previous pages */}
              {currentPage > 3 && (
                <PaginationItem>
                  <PaginationLink 
                    onClick={() => !isLoading && !isMutating ? setCurrentPage(currentPage - 2) : undefined}
                    className={isLoading || isMutating ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  >
                    {currentPage - 2}
                  </PaginationLink>
                </PaginationItem>
              )}
              
              {currentPage > 1 && (
                <PaginationItem>
                  <PaginationLink 
                    onClick={() => !isLoading && !isMutating ? setCurrentPage(currentPage - 1) : undefined}
                    className={isLoading || isMutating ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  >
                    {currentPage - 1}
                  </PaginationLink>
                </PaginationItem>
              )}
              
              {/* Current page */}
              <PaginationItem>
                <PaginationLink 
                  isActive
                  className={isLoading || isMutating ? "opacity-50" : ""}
                >
                  {currentPage}
                </PaginationLink>
              </PaginationItem>
              
              {/* Next pages */}
              {currentPage < totalPages && (
                <PaginationItem>
                  <PaginationLink 
                    onClick={() => !isLoading && !isMutating ? setCurrentPage(currentPage + 1) : undefined}
                    className={isLoading || isMutating ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  >
                    {currentPage + 1}
                  </PaginationLink>
                </PaginationItem>
              )}
              
              {currentPage < totalPages - 1 && (
                <PaginationItem>
                  <PaginationLink 
                    onClick={() => !isLoading && !isMutating ? setCurrentPage(currentPage + 2) : undefined}
                    className={isLoading || isMutating ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  >
                    {currentPage + 2}
                  </PaginationLink>
                </PaginationItem>
              )}
              
              {/* Last page */}
              {currentPage < totalPages - 2 && (
                <PaginationItem>
                  <PaginationLink 
                    onClick={() => !isLoading && !isMutating ? setCurrentPage(totalPages) : undefined}
                    className={isLoading || isMutating ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  >
                    {totalPages}
                  </PaginationLink>
                </PaginationItem>
              )}
              
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
          
          {/* Items per page */}
          <div className="flex items-center space-x-2">
            <span>Show:</span>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="border rounded-md px-2 py-1"
              disabled={isLoading || isMutating}
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
            <span>per page</span>
            <span className="ml-2">
              Total: {totalRates}
            </span>
          </div>
        </div>
      )}

      {/* Create Billing Rate Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Billing Rate</DialogTitle>
            <DialogDescription>
              Fill in the details to add a new billing rate.
            </DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={onCreateSubmit} className="space-y-4">
              <FormField
                control={createForm.control}
                name="rateName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rate Name*</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter rate name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="ratePerHour"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rate Per Hour*</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01"
                        min="0"
                        placeholder="Enter rate per hour" 
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value))}
                        value={field.value}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Currency*</FormLabel>
                    <FormControl>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        {...field}
                      >
                        {CURRENCY_OPTIONS.map((currency) => (
                          <option key={currency} value={currency}>
                            {currency}
                          </option>
                        ))}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Enter description" 
                        {...field} 
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active</FormLabel>
                      <FormDescription>
                        Inactive rates won't be available for selection in timesheets
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button 
                  type="button"
                  variant="outline" 
                  onClick={() => setCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={createBillingRateMutation.isPending}
                >
                  {createBillingRateMutation.isPending && <Loader2 size={16} className="animate-spin mr-1" />}
                  Add Billing Rate
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Billing Rate Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Billing Rate</DialogTitle>
            <DialogDescription>
              Update the details for {selectedRate?.rateName}.
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={onEditSubmit} className="space-y-4">
              <FormField
                control={editForm.control}
                name="rateName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rate Name*</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter rate name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="ratePerHour"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rate Per Hour*</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01"
                        min="0"
                        placeholder="Enter rate per hour" 
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value))}
                        value={field.value}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Currency*</FormLabel>
                    <FormControl>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        {...field}
                      >
                        {CURRENCY_OPTIONS.map((currency) => (
                          <option key={currency} value={currency}>
                            {currency}
                          </option>
                        ))}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Enter description" 
                        {...field} 
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active</FormLabel>
                      <FormDescription>
                        Inactive rates won't be available for selection in timesheets
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button 
                  type="button"
                  variant="outline" 
                  onClick={() => setEditDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={updateBillingRateMutation.isPending}
                >
                  {updateBillingRateMutation.isPending && <Loader2 size={16} className="animate-spin mr-1" />}
                  Update Billing Rate
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Billing Rate</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the "{selectedRate?.rateName}" billing rate? This action cannot be undone.
              <br /><br />
              <strong>Warning:</strong> If this billing rate is referenced by any timesheet, the deletion will fail.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDeleteConfirm}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              disabled={deleteBillingRateMutation.isPending}
            >
              {deleteBillingRateMutation.isPending && <Loader2 size={16} className="animate-spin mr-1" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
