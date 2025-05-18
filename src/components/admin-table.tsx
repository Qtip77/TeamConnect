"use client";

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

// Import your auth client
import { authClient } from '@/lib/auth-client';
// Import existing schemas
import { userSelect } from '@/server/validations/auth.schema';

// Use the existing User type
type User = z.infer<typeof userSelect>;

// Get the role enum values from the schema
const ROLE_OPTIONS = ["driver", "maintenance", "admin"] as const;

// Define schema for operations that don't exist in the server schemas
const listUsersQuerySchema = z.object({
  searchField: z.enum(['email', 'name']).optional(),
  searchOperator: z.enum(['contains', 'starts_with', 'ends_with']).optional(),
  searchValue: z.string().optional(),
  limit: z.number().optional(),
  offset: z.number().optional(),
  sortBy: z.string().optional(),
  sortDirection: z.enum(['asc', 'desc']).optional(),
  filterField: z.string().optional(),
  filterOperator: z.enum(['eq']).optional(),
  filterValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
});

// Updated setRoleSchema to use the enum
const setRoleSchema = z.object({
  userId: z.string(),
  role: z.enum(ROLE_OPTIONS),
});

const banUserSchema = z.object({
  userId: z.string(),
  banReason: z.string().optional(),
});

const unbanUserSchema = z.object({
  userId: z.string(),
});

const resetPasswordSchema = z.object({
  email: z.string().email(),
  redirectTo: z.string().url(),
});

const impersonateUserSchema = z.object({
  userId: z.string(),
});

const filterFormSchema = z.object({
  searchField: z.enum(['email', 'name']),
  searchTerm: z.string(),
  roleFilter: z.string(),
});

// Define types from schemas
type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
type SetRoleParams = z.infer<typeof setRoleSchema>;
type BanUserParams = z.infer<typeof banUserSchema>;
type UnbanUserParams = z.infer<typeof unbanUserSchema>;
type ResetPasswordParams = z.infer<typeof resetPasswordSchema>;
type ImpersonateUserParams = z.infer<typeof impersonateUserSchema>;
type FilterFormValues = z.infer<typeof filterFormSchema>;

// Ban user form schema
const banUserFormSchema = z.object({
  banReason: z.string().optional(),
});
type BanUserFormValues = z.infer<typeof banUserFormSchema>;

// Define response type
interface ListUsersResponse {
  users: User[];
  total: number;
  limit?: number;
  offset?: number;
}

const DEFAULT_LIMIT = 10;

const AdminTable: React.FC = () => {
  const queryClient = useQueryClient();

  // State for pagination, filtering, and sorting
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(DEFAULT_LIMIT);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [searchField, setSearchField] = useState<'email' | 'name'>('email');
  const [roleFilter, setRoleFilter] = useState<string>('');

  // Dialog states
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [impersonateDialogOpen, setImpersonateDialogOpen] = useState(false);
  
  // Currently selected user for actions
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState<typeof ROLE_OPTIONS[number] | ''>('');

  // Ban user form
  const banForm = useForm<BanUserFormValues>({
    resolver: zodResolver(banUserFormSchema),
    defaultValues: {
      banReason: '',
    },
  });

  // Form handling with React Hook Form
  const filterForm = useForm<FilterFormValues>({
    resolver: zodResolver(filterFormSchema),
    defaultValues: {
      searchField: 'email',
      searchTerm: '',
      roleFilter: '',
    },
  });

  // Query key for the listUsers API
  const listUsersQueryKey = ['adminUsers', currentPage, limit, searchTerm, searchField, roleFilter];

  // Query to fetch users
  const { data, isLoading, error } = useQuery({
    queryKey: listUsersQueryKey,
    queryFn: async () => {
      const query: ListUsersQuery = {
        limit,
        offset: (currentPage - 1) * limit,
        sortBy: 'createdAt',
        sortDirection: 'desc',
      };

      if (searchTerm.trim()) {
        query.searchField = searchField;
        query.searchOperator = 'contains';
        query.searchValue = searchTerm.trim();
      }

      if (roleFilter.trim()) {
        query.filterField = 'role';
        query.filterOperator = 'eq';
        query.filterValue = roleFilter.trim();
      }

      const response = await authClient.admin.listUsers({ query });
      return response.data as ListUsersResponse;
    },
  });

  // Mutation to set a user's role
  const setRoleMutation = useMutation({
    mutationFn: async (params: SetRoleParams) => {
      const response = await authClient.admin.setRole(params);
      return response.data;
    },
    onSuccess: () => {
      toast.success('User role updated successfully');
      queryClient.invalidateQueries({ queryKey: listUsersQueryKey });
      setRoleDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update user role');
    },
  });

  // Mutation to ban a user
  const banUserMutation = useMutation({
    mutationFn: async (params: BanUserParams) => {
      const response = await authClient.admin.banUser(params);
      return response.data;
    },
    onSuccess: () => {
      toast.success('User banned successfully');
      queryClient.invalidateQueries({ queryKey: listUsersQueryKey });
      setBanDialogOpen(false);
      banForm.reset();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to ban user');
    },
  });

  // Mutation to unban a user
  const unbanUserMutation = useMutation({
    mutationFn: async (params: UnbanUserParams) => {
      const response = await authClient.admin.unbanUser(params);
      return response.data;
    },
    onSuccess: () => {
      toast.success('User unbanned successfully');
      queryClient.invalidateQueries({ queryKey: listUsersQueryKey });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to unban user');
    },
  });

  // Mutation to reset a user's password
  const resetPasswordMutation = useMutation({
    mutationFn: async (params: ResetPasswordParams) => {
      const response = await authClient.forgetPassword(params);
      return response.data;
    },
    onSuccess: (_, variables) => {
      toast.success(`Password reset link sent to ${variables.email}`);
      setResetPasswordDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to send password reset link');
    },
  });

  // Mutation to impersonate a user
  const impersonateUserMutation = useMutation({
    mutationFn: async (params: ImpersonateUserParams) => {
      const response = await authClient.admin.impersonateUser(params);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Successfully impersonating user');
      setImpersonateDialogOpen(false);
      window.location.href = '/'; // Redirect to homepage after impersonation
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to impersonate user');
    },
  });

  // Handler to set a user's role
  const handleSetRole = (user: User) => {
    setSelectedUser(user);
    setSelectedRole(user.role as typeof ROLE_OPTIONS[number]);
    setRoleDialogOpen(true);
  };

  // Handler to update role
  const handleRoleUpdate = () => {
    if (!selectedUser || !selectedRole) return;
    
    const result = setRoleSchema.safeParse({ 
      userId: selectedUser.id,
      role: selectedRole 
    });
    
    if (result.success) {
      setRoleMutation.mutate(result.data);
    } else {
      toast.error('Invalid role selection');
    }
  };

  // Handler to ban a user
  const handleBanUser = (user: User) => {
    setSelectedUser(user);
    setBanDialogOpen(true);
  };

  // Handler to submit ban
  const handleBanSubmit = (values: BanUserFormValues) => {
    if (!selectedUser) return;
    
    const result = banUserSchema.safeParse({ 
      userId: selectedUser.id,
      banReason: values.banReason 
    });
    
    if (result.success) {
      banUserMutation.mutate(result.data);
    } else {
      toast.error('Invalid ban parameters');
    }
  };

  // Handler to unban a user
  const handleUnbanUser = (user: User) => {
    const result = unbanUserSchema.safeParse({ userId: user.id });
    
    if (result.success) {
      unbanUserMutation.mutate(result.data);
    } else {
      toast.error('Invalid user ID');
    }
  };

  // Handler to reset a user's password
  const handleResetPassword = (user: User) => {
    setSelectedUser(user);
    setResetPasswordDialogOpen(true);
  };

  // Handler to confirm password reset
  const handleConfirmPasswordReset = () => {
    if (!selectedUser) return;
    
    const result = resetPasswordSchema.safeParse({
      email: selectedUser.email,
      redirectTo: '/auth/reset-password',
    });
    
    if (result.success) {
      resetPasswordMutation.mutate(result.data);
    } else {
      toast.error('Invalid email format');
    }
  };

  // Handler to impersonate a user
  const handleImpersonateUser = (user: User) => {
    setSelectedUser(user);
    setImpersonateDialogOpen(true);
  };

  // Handler to confirm impersonation
  const handleConfirmImpersonation = () => {
    if (!selectedUser) return;
    
    const result = impersonateUserSchema.safeParse({ userId: selectedUser.id });
    
    if (result.success) {
      impersonateUserMutation.mutate(result.data);
    } else {
      toast.error('Invalid user ID');
    }
  };

  // Handlers for search, filter, and pagination
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    filterForm.setValue('searchTerm', value);
  };

  const handleSearchFieldChange = (value: string) => {
    filterForm.setValue('searchField', value as 'email' | 'name');
  };

  const handleRoleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    filterForm.setValue('roleFilter', value);
  };

  const handleFilterSubmit = (values: FilterFormValues) => {
    setSearchField(values.searchField);
    setSearchTerm(values.searchTerm);
    setRoleFilter(values.roleFilter);
    setCurrentPage(1);
  };

  // Derived values
  const users = data?.users || [];
  const totalUsers = data?.total || 0;
  const totalPages = Math.ceil(totalUsers / limit);

  // Determine if any mutation is in progress
  const isMutating =
    setRoleMutation.isPending ||
    banUserMutation.isPending ||
    unbanUserMutation.isPending ||
    resetPasswordMutation.isPending ||
    impersonateUserMutation.isPending;

  // Render loading state
  if (isLoading && !data) {
    return (
      <div className="flex justify-center items-center p-10">
        <Loader2 className="animate-spin mr-2" />
        <span>Loading users...</span>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="text-red-500 p-5 border border-red-500 rounded-md bg-red-50">
        Error loading users: {(error as Error).message}
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">User Management</h1>

      {/* Filters */}
      <form onSubmit={filterForm.handleSubmit(handleFilterSubmit)} className="flex flex-wrap gap-4 mb-6 items-center">
        <Select
          value={filterForm.watch('searchField')}
          onValueChange={handleSearchFieldChange}
        >
          <SelectTrigger className="border rounded-md w-[180px]">
            <SelectValue placeholder="Search by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="email">Search by Email</SelectItem>
            <SelectItem value="name">Search by Name</SelectItem>
          </SelectContent>
        </Select>
        
        <Input
          {...filterForm.register('searchTerm')}
          placeholder={`Search ${filterForm.watch('searchField')}...`}
          disabled={isLoading || isMutating}
          className="w-64"
          onChange={handleSearchChange}
        />
        
        <Input
          {...filterForm.register('roleFilter')}
          placeholder="Filter by role"
          disabled={isLoading || isMutating}
          onChange={handleRoleFilterChange}
          className="w-48"
        />
        
        <Button
          type="submit"
          disabled={isLoading || isMutating}
        >
          {isLoading ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
          Search
        </Button>
        
        <Button
          type="button"
          onClick={() => {
            filterForm.reset();
            setSearchField('email');
            setSearchTerm('');
            setRoleFilter('');
            queryClient.invalidateQueries({ queryKey: listUsersQueryKey });
          }}
          disabled={isLoading || isMutating}
          variant="outline"
        >
          Clear Filters
        </Button>
      </form>

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

      {/* Users table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.length > 0 ? (
            users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>{user.id}</TableCell>
                <TableCell>{user.name || 'N/A'}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>{user.role}</TableCell>
                <TableCell>
                  {user.banned 
                    ? <span className="text-red-700">
                        Banned {user.banReason ? `(${user.banReason})` : ''}
                      </span> 
                    : <span className="text-green-700">Active</span>
                  }
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    <Select 
                      onValueChange={(value) => {
                        // Set the selected user first
                        setSelectedUser(user);
                        
                        // Then trigger the appropriate action based on selection
                        switch (value) {
                          case 'set-role':
                            setSelectedRole(user.role as typeof ROLE_OPTIONS[number]);
                            setRoleDialogOpen(true);
                            break;
                          case 'ban':
                            setBanDialogOpen(true);
                            break;
                          case 'unban':
                            handleUnbanUser(user);
                            break;
                          case 'reset-password':
                            setResetPasswordDialogOpen(true);
                            break;
                          case 'impersonate':
                            setImpersonateDialogOpen(true);
                            break;
                        }
                      }}
                      disabled={
                        setRoleMutation.isPending && setRoleMutation.variables?.userId === user.id ||
                        banUserMutation.isPending && banUserMutation.variables?.userId === user.id ||
                        unbanUserMutation.isPending && unbanUserMutation.variables?.userId === user.id ||
                        resetPasswordMutation.isPending && resetPasswordMutation.variables?.email === user.email ||
                        impersonateUserMutation.isPending && impersonateUserMutation.variables?.userId === user.id
                      }
                    >
                      <SelectTrigger 
                        className="w-[130px] bg-blue-50 text-white-700 border-blue-200 hover:bg-blue-100"
                      >
                        {(setRoleMutation.isPending && setRoleMutation.variables?.userId === user.id) ||
                         (banUserMutation.isPending && banUserMutation.variables?.userId === user.id) ||
                         (unbanUserMutation.isPending && unbanUserMutation.variables?.userId === user.id) ||
                         (resetPasswordMutation.isPending && resetPasswordMutation.variables?.email === user.email) ||
                         (impersonateUserMutation.isPending && impersonateUserMutation.variables?.userId === user.id) ? (
                          <div className="flex items-center">
                            <Loader2 size={14} className="animate-spin mr-2" />
                            <span>Processing...</span>
                          </div>
                        ) : (
                          <SelectValue placeholder="Actions" />
                        )}
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="set-role" className="text-white-700">
                          Set Role
                        </SelectItem>
                        
                        {user.banned ? (
                          <SelectItem value="unban" className="text-white-700">
                            Unban
                          </SelectItem>
                        ) : (
                          <SelectItem value="ban" className="text-white-700">
                            Ban
                          </SelectItem>
                        )}
                        
                        <SelectItem value="reset-password" className="text-white-700">
                          Reset Password
                        </SelectItem>
                        
                        <SelectItem value="impersonate" className="text-white-700">
                          Impersonate
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-6">
                No users found
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* Pagination */}
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
        
        {/* Items per page and total count display */}
        <div className="flex place-items-start gap-4">
          <span>Show: </span>
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
          <span className="flex-justify-center">per page </span>
          <span className="ml-2 text-sm">
            Total: {totalUsers}
          </span>
        </div>
      </div>

      {/* Role Dialog */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Role</DialogTitle>
            <DialogDescription>
              Change the role for user {selectedUser?.name || selectedUser?.email || 'selected user'}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select 
              value={selectedRole}
              onValueChange={(value) => setSelectedRole(value as typeof ROLE_OPTIONS[number])}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((role) => (
                  <SelectItem key={role} value={role}>
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setRoleDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleRoleUpdate}
              disabled={setRoleMutation.isPending}
            >
              {setRoleMutation.isPending && <Loader2 size={16} className="animate-spin mr-1" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ban User Dialog */}
      <Dialog open={banDialogOpen} onOpenChange={setBanDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ban User</DialogTitle>
            <DialogDescription>
              This will prevent the user from logging in. Are you sure?
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={banForm.handleSubmit(handleBanSubmit)}>
            <div className="py-4">
              <label className="text-sm font-medium mb-2 block">Ban Reason (optional)</label>
              <Input
                {...banForm.register('banReason')}
                placeholder="Enter reason for banning"
              />
            </div>
            <DialogFooter>
              <Button 
                type="button"
                variant="outline" 
                onClick={() => setBanDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                variant="destructive"
                disabled={banUserMutation.isPending}
              >
                {banUserMutation.isPending && <Loader2 size={16} className="animate-spin mr-1" />}
                Ban User
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetPasswordDialogOpen} onOpenChange={setResetPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Send a password reset link to {selectedUser?.email}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setResetPasswordDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmPasswordReset}
              disabled={resetPasswordMutation.isPending}
            >
              {resetPasswordMutation.isPending && <Loader2 size={16} className="animate-spin mr-1" />}
              Send Reset Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Impersonate User Dialog */}
      <Dialog open={impersonateDialogOpen} onOpenChange={setImpersonateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Impersonate User</DialogTitle>
            <DialogDescription>
              You will be logged in as {selectedUser?.name || selectedUser?.email}. This is for testing and troubleshooting purposes only.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setImpersonateDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmImpersonation}
              disabled={impersonateUserMutation.isPending}
            >
              {impersonateUserMutation.isPending && <Loader2 size={16} className="animate-spin mr-1" />}
              Impersonate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminTable;
