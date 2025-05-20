"use client"

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, Edit } from 'lucide-react';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

// Import client RPC
import { clientRPC } from '@/lib/client-rpc';

// Import truck schemas
import { 
  type Truck, 
  type TruckCreate, 
  type TruckUpdate,
  truckCreateSchema, 
  truckUpdateSchema 
} from '@/server/validations/truck.schema';

interface TruckTableProps {
  isAdmin: boolean;
}

const DEFAULT_LIMIT = 10;

export function TruckTable({ isAdmin }: TruckTableProps) {
  const queryClient = useQueryClient();
  
  // State for pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(DEFAULT_LIMIT);

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  // Currently selected truck for actions
  const [selectedTruck, setSelectedTruck] = useState<Truck | null>(null);

  // Forms for create and update operations
  const createForm = useForm<TruckCreate>({
    resolver: zodResolver(truckCreateSchema),
    defaultValues: {
      unitNumber: "",
      make: "",
      model: "",
      serialNumber: "",
      lastOdometerReading: null,
      lastMaintenanceOdometerReading: null,
      maintenanceIntervalKm: 10000,
    },
  });

  const editForm = useForm<TruckUpdate>({
    resolver: zodResolver(truckUpdateSchema),
    defaultValues: {
      unitNumber: "",
      make: "",
      model: "",
      serialNumber: "",
      lastOdometerReading: null,
      lastMaintenanceOdometerReading: null,
      maintenanceIntervalKm: 10000,
    },
  });

  // Query key for the trucks API
  const trucksQueryKey = ['trucks', currentPage, limit];

  // Query to fetch trucks
  const { data, isLoading, error } = useQuery({
    queryKey: trucksQueryKey,
    queryFn: async () => {
      const response = await clientRPC.api.trucks.$get();
      return response.json() as Promise<Truck[]>;
    },
  });

  // Mutation to create a new truck
  const createTruckMutation = useMutation({
    mutationFn: async (data: TruckCreate) => {
      const response = await clientRPC.api.trucks.$post({ json: data });
      
      // Check if the response is not ok (non-2xx status code)
      if (!response.ok) {
        // Parse the error response
        const errorData = await response.json() as { error: string };
        // Throw the error to be caught by onError
        throw new Error(errorData.error || 'Failed to create truck');
      }
      
      return response.json() as Promise<Truck>;
    },
    onSuccess: () => {
      toast.success('Truck created successfully');
      queryClient.invalidateQueries({ queryKey: trucksQueryKey });
      setCreateDialogOpen(false);
      createForm.reset();
    },
    onError: (error: any) => {
      if (error.message?.includes("unit number or serial number already exists")) {
        toast.error("A truck with this unit number or serial number already exists");
      } else {
        toast.error(error.message || 'Failed to create truck');
      }
    },
  });

  // Mutation to update a truck
  const updateTruckMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: TruckUpdate }) => {
      try {
        const response = await clientRPC.api.trucks[":id"].$patch({
          param: { id },
          json: data,
        });
        
        // Check if the response is not ok (non-2xx status code)
        if (!response.ok) {
          // Parse the error response
          const errorData = await response.json() as { error: string };
          // Throw the error to be caught by onError
          throw new Error(errorData.error || 'Failed to update truck');
        }
        
        return response.json() as Promise<Truck>;
      } catch (error: any) {
        if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
          throw new Error('Network error: Unable to connect to the server');
        }
        throw error;
      }
    },
    onSuccess: () => {
      toast.success('Truck updated successfully');
      queryClient.invalidateQueries({ queryKey: trucksQueryKey });
      setEditDialogOpen(false);
    },
    onError: (error: any) => {
      if (error.message?.includes("unit number or serial number conflict")) {
        toast.error("A truck with this unit number or serial number already exists");
      } else if (error.message?.includes("Network error")) {
        toast.error(error.message);
        console.error("Network error when updating truck:", error);
      } else {
        toast.error(error.message || 'Failed to update truck');
      }
    },
  });

  // Mutation to delete a truck
  const deleteTruckMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await clientRPC.api.trucks[":id"].$delete({
        param: { id },
      });
      return response.json();
    },
    onSuccess: () => {
      toast.success('Truck deleted successfully');
      queryClient.invalidateQueries({ queryKey: trucksQueryKey });
      setDeleteDialogOpen(false);
    },
    onError: (error: any) => {
      if (error.message?.includes("FOREIGN KEY constraint failed")) {
        toast.error("This truck is referenced by existing timesheets and cannot be deleted");
      } else {
        toast.error(error.message || 'Failed to delete truck');
      }
    },
  });

  // Handler to open create dialog
  const handleCreateTruck = () => {
    createForm.reset();
    setCreateDialogOpen(true);
  };

  // Handler to open edit dialog
  const handleEditTruck = (truck: Truck) => {
    setSelectedTruck(truck);
    editForm.reset({
      unitNumber: truck.unitNumber,
      make: truck.make,
      model: truck.model,
      serialNumber: truck.serialNumber,
      lastOdometerReading: truck.lastOdometerReading,
      lastMaintenanceOdometerReading: truck.lastMaintenanceOdometerReading,
      maintenanceIntervalKm: truck.maintenanceIntervalKm,
    });
    setEditDialogOpen(true);
  };

  // Handler to open delete dialog
  const handleDeleteTruck = (truck: Truck) => {
    setSelectedTruck(truck);
    setDeleteDialogOpen(true);
  };

  // Handler to submit create form
  const onCreateSubmit = (values: TruckCreate) => {
    createTruckMutation.mutate(values);
  };

  // Handler to submit edit form
  const onEditSubmit = (values: TruckUpdate) => {
    if (!selectedTruck) return;
    updateTruckMutation.mutate({ id: selectedTruck.id, data: values });
  };

  // Handler to confirm deletion
  const onDeleteConfirm = () => {
    if (!selectedTruck) return;
    deleteTruckMutation.mutate(selectedTruck.id);
  };

  // Calculate pagination
  const totalTrucks = data?.length || 0;
  const paginatedTrucks = data?.slice((currentPage - 1) * limit, currentPage * limit) || [];
  const totalPages = Math.ceil(totalTrucks / limit);

  // Determine if any mutation is in progress
  const isMutating =
    createTruckMutation.isPending ||
    updateTruckMutation.isPending ||
    deleteTruckMutation.isPending;

  // Render loading state
  if (isLoading && !data) {
    return (
      <div className="flex justify-center items-center p-10">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        <span>Loading trucks...</span>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="text-red-500 p-5 border border-red-500 rounded-md bg-red-50">
        Error loading trucks: {(error as Error).message}
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Truck Management</h1>
        {isAdmin && (
          <Button onClick={handleCreateTruck} disabled={isMutating}>
            <Plus className="mr-2 h-4 w-4" />
            Add New Truck
          </Button>
        )}
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

      {/* Trucks table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Unit Number</TableHead>
            <TableHead>Make</TableHead>
            <TableHead>Model</TableHead>
            <TableHead>Serial Number</TableHead>
            <TableHead>Last Odometer Reading</TableHead>
            <TableHead>Last Maintenance Odometer Reading</TableHead>
            <TableHead>Maintenance Interval (km)</TableHead>
            {isAdmin && <TableHead>Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedTrucks.length > 0 ? (
            paginatedTrucks.map((truck) => (
              <TableRow key={truck.id}>
                <TableCell>{truck.unitNumber}</TableCell>
                <TableCell>{truck.make || 'N/A'}</TableCell>
                <TableCell>{truck.model || 'N/A'}</TableCell>
                <TableCell>{truck.serialNumber || 'N/A'}</TableCell>
                <TableCell>{truck.lastOdometerReading?.toLocaleString() || 'N/A'}</TableCell>
                <TableCell>{truck.lastMaintenanceOdometerReading?.toLocaleString() || 'N/A'}</TableCell>
                <TableCell>{truck.maintenanceIntervalKm.toLocaleString()}</TableCell>
                {isAdmin && (
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleEditTruck(truck)}
                        disabled={isMutating}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteTruck(truck)}
                        disabled={isMutating}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={isAdmin ? 7 : 6} className="text-center py-6">
                No trucks found
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* Pagination */}
      {totalTrucks > 0 && (
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
              Total: {totalTrucks}
            </span>
          </div>
        </div>
      )}

      {/* Create Truck Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Truck</DialogTitle>
            <DialogDescription>
              Fill in the details to add a new truck to the fleet.
            </DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
              <FormField
                control={createForm.control}
                name="unitNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit Number*</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter unit number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="make"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Make</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Enter make" 
                        {...field} 
                        value={field.value || ""}
                        onChange={(e) => field.onChange(e.target.value || null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="model"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Model</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Enter model" 
                        {...field} 
                        value={field.value || ""}
                        onChange={(e) => field.onChange(e.target.value || null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="serialNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Serial Number</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Enter serial number" 
                        {...field} 
                        value={field.value || ""}
                        onChange={(e) => field.onChange(e.target.value || null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="lastOdometerReading"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Odometer Reading (km)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="0"
                        placeholder="Enter odometer reading" 
                        {...field} 
                        value={field.value === null ? "" : field.value}
                        onChange={(e) => {
                          const value = e.target.value === "" ? null : parseInt(e.target.value);
                          field.onChange(value);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="lastMaintenanceOdometerReading"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Maintenance Odometer Reading (km)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="0"
                        placeholder="Enter maintenance odometer reading" 
                        {...field} 
                        value={field.value === null ? "" : field.value}
                        onChange={(e) => {
                          const value = e.target.value === "" ? null : parseInt(e.target.value);
                          field.onChange(value);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="maintenanceIntervalKm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Maintenance Interval (km)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="1"
                        placeholder="Enter maintenance interval" 
                        {...field} 
                        value={field.value || ""}
                        onChange={(e) => {
                          const value = e.target.value === "" ? null : parseInt(e.target.value);
                          field.onChange(value);
                        }}
                      />
                    </FormControl>
                    <FormDescription>
                      Recommended maintenance schedule in kilometers. Default: 10,000 km
                    </FormDescription>
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
                  disabled={createTruckMutation.isPending}
                >
                  {createTruckMutation.isPending && <Loader2 size={16} className="animate-spin mr-1" />}
                  Add Truck
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Truck Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Truck</DialogTitle>
            <DialogDescription>
              Update the details for truck {selectedTruck?.unitNumber}.
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="unitNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit Number*</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter unit number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="make"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Make</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Enter make" 
                        {...field} 
                        value={field.value || ""}
                        onChange={(e) => field.onChange(e.target.value || null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="model"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Model</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Enter model" 
                        {...field} 
                        value={field.value || ""}
                        onChange={(e) => field.onChange(e.target.value || null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="serialNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Serial Number</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Enter serial number" 
                        {...field} 
                        value={field.value || ""}
                        onChange={(e) => field.onChange(e.target.value || null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="lastOdometerReading"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Odometer Reading (km)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="0"
                        placeholder="Enter odometer reading" 
                        {...field} 
                        value={field.value === null ? "" : field.value}
                        onChange={(e) => {
                          const value = e.target.value === "" ? null : parseInt(e.target.value);
                          field.onChange(value);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="lastMaintenanceOdometerReading"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Maintenance Odometer Reading (km)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="0"
                        placeholder="Enter maintenance odometer reading" 
                        {...field} 
                        value={field.value === null ? "" : field.value}
                        onChange={(e) => {
                          const value = e.target.value === "" ? null : parseInt(e.target.value);
                          field.onChange(value);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="maintenanceIntervalKm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Maintenance Interval (km)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="1"
                        placeholder="Enter maintenance interval" 
                        {...field} 
                        value={field.value || ""}
                        onChange={(e) => {
                          const value = e.target.value === "" ? null : parseInt(e.target.value);
                          field.onChange(value);
                        }}
                      />
                    </FormControl>
                    <FormDescription>
                      Recommended maintenance schedule in kilometers. Default: 10,000 km
                    </FormDescription>
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
                  disabled={updateTruckMutation.isPending}
                >
                  {updateTruckMutation.isPending && <Loader2 size={16} className="animate-spin mr-1" />}
                  Update Truck
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
            <AlertDialogTitle>Delete Truck</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete truck {selectedTruck?.unitNumber}? This action cannot be undone.
              <br /><br />
              <strong>Warning:</strong> If this truck is referenced by any timesheet, the deletion will fail.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDeleteConfirm}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              disabled={deleteTruckMutation.isPending}
            >
              {deleteTruckMutation.isPending && <Loader2 size={16} className="animate-spin mr-1" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
