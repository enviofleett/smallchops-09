
import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getCustomerPreferences, CustomerCommunicationPreference } from '@/api/customerPreferences';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Search, Edit } from 'lucide-react';
import EditPreferenceDialog from './EditPreferenceDialog';
import { useDebounce } from '@/hooks/use-debounce';

const CustomerPreferencesTab = () => {
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 500);
  const [selectedPreference, setSelectedPreference] = useState<CustomerCommunicationPreference | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['customerPreferences', page, debouncedSearchQuery],
    queryFn: () => getCustomerPreferences({ page, pageSize: 15, searchQuery: debouncedSearchQuery }),
    placeholderData: (previousData) => previousData,
  });

  const preferences = data?.preferences || [];
  const count = data?.count || 0;
  const totalPages = Math.ceil(count / 15);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Customer Communication Preferences</CardTitle>
        <p className="text-sm text-muted-foreground">
          Manage what, when, and how you communicate with your customers.
        </p>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between mb-4">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by customer email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : isError ? (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer Email</TableHead>
                  <TableHead>Order Updates</TableHead>
                  <TableHead>Promotions</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Language</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preferences.length > 0 ? (
                  preferences.map((pref) => (
                    <TableRow key={pref.id}>
                      <TableCell className="font-medium">{pref.customer_email}</TableCell>
                      <TableCell>
                        <Badge variant={pref.allow_order_updates ? 'default' : 'secondary'}>
                          {pref.allow_order_updates ? 'Allowed' : 'Denied'}
                        </Badge>
                      </TableCell>
                       <TableCell>
                        <Badge variant={pref.allow_promotions ? 'default' : 'secondary'}>
                          {pref.allow_promotions ? 'Allowed' : 'Denied'}
                        </Badge>
                      </TableCell>
                      <TableCell>{pref.preferred_channel}</TableCell>
                      <TableCell>{pref.language}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => setSelectedPreference(pref)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center h-24">
                      No preferences found. Preferences are created automatically when a notification is sent to a new customer.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {totalPages > 1 && (
          <Pagination className="mt-6">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious href="#" onClick={() => handlePageChange(page - 1)} />
              </PaginationItem>
              {[...Array(totalPages)].map((_, i) => (
                <PaginationItem key={i}>
                  <PaginationLink href="#" isActive={page === i + 1} onClick={() => handlePageChange(i + 1)}>
                    {i + 1}
                  </PaginationLink>
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext href="#" onClick={() => handlePageChange(page + 1)} />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </CardContent>
      {selectedPreference && (
        <EditPreferenceDialog
          isOpen={!!selectedPreference}
          onClose={() => setSelectedPreference(null)}
          preference={selectedPreference}
        />
      )}
    </Card>
  );
};

export default CustomerPreferencesTab;
