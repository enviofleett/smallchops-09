import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar, Search, Filter, Eye, Phone, Mail, Building, Users, Clock, CheckCircle, XCircle, MessageSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface CateringBooking {
  id: string;
  full_name: string;
  email: string;
  phone_number: string;
  event_date: string;
  number_of_guests: number;
  event_type: string;
  is_company_order: boolean;
  company_name?: string;
  additional_details?: string;
  status: string;
  admin_notes?: string;
  quote_amount?: number;
  created_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
}

const Bookings = () => {
  const [bookings, setBookings] = useState<CateringBooking[]>([]);
  const [filteredBookings, setFilteredBookings] = useState<CateringBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [eventTypeFilter, setEventTypeFilter] = useState('all');
  const [selectedBooking, setSelectedBooking] = useState<CateringBooking | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [quoteAmount, setQuoteAmount] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    fetchBookings();
  }, []);

  useEffect(() => {
    filterBookings();
  }, [bookings, searchTerm, statusFilter, eventTypeFilter]);

  const fetchBookings = async () => {
    try {
      const { data, error } = await supabase
        .from('catering_bookings')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBookings(data || []);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      toast.error('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  const filterBookings = () => {
    let filtered = bookings;

    if (searchTerm) {
      filtered = filtered.filter(booking =>
        booking.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        booking.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        booking.phone_number.includes(searchTerm) ||
        (booking.company_name && booking.company_name.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(booking => booking.status === statusFilter);
    }

    if (eventTypeFilter !== 'all') {
      filtered = filtered.filter(booking => booking.event_type === eventTypeFilter);
    }

    setFilteredBookings(filtered);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'approved': return 'bg-green-100 text-green-800 border-green-300';
      case 'rejected': return 'bg-red-100 text-red-800 border-red-300';
      case 'contacted': return 'bg-blue-100 text-blue-800 border-blue-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getEventTypeLabel = (eventType: string) => {
    switch (eventType) {
      case 'weddings': return 'Wedding';
      case 'office_event': return 'Office Event';
      case 'funerals': return 'Funeral';
      default: return eventType;
    }
  };

  const updateBookingStatus = async (id: string, status: string) => {
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('catering_bookings')
        .update({
          status,
          admin_notes: adminNotes || null,
          quote_amount: quoteAmount ? parseFloat(quoteAmount) : null,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      toast.success(`Booking ${status} successfully`);
      fetchBookings();
      setIsDetailsOpen(false);
      setAdminNotes('');
      setQuoteAmount('');
    } catch (error) {
      console.error('Error updating booking:', error);
      toast.error('Failed to update booking');
    } finally {
      setIsUpdating(false);
    }
  };

  const openBookingDetails = (booking: CateringBooking) => {
    setSelectedBooking(booking);
    setAdminNotes(booking.admin_notes || '');
    setQuoteAmount(booking.quote_amount?.toString() || '');
    setIsDetailsOpen(true);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Catering Bookings</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Catering Bookings</h1>
        <Badge variant="outline" className="text-lg px-3 py-1">
          {filteredBookings.length} submissions
        </Badge>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search bookings..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="contacted">Contacted</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>

            <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by event type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Event Types</SelectItem>
                <SelectItem value="weddings">Weddings</SelectItem>
                <SelectItem value="office_event">Office Events</SelectItem>
                <SelectItem value="funerals">Funerals</SelectItem>
              </SelectContent>
            </Select>

            <Button 
              variant="outline" 
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setEventTypeFilter('all');
              }}
            >
              <Filter className="w-4 h-4 mr-2" />
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Bookings Grid */}
      {filteredBookings.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No bookings found</h3>
            <p className="text-gray-500">
              {searchTerm || statusFilter !== 'all' || eventTypeFilter !== 'all' 
                ? 'Try adjusting your filters to see more results.'
                : 'Catering booking requests will appear here once customers submit them.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredBookings.map((booking) => (
            <Card key={booking.id} className="hover:shadow-lg transition-shadow duration-200">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{booking.full_name}</CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-1">
                      <Calendar className="w-4 h-4" />
                      {format(new Date(booking.event_date), 'MMM dd, yyyy')}
                    </CardDescription>
                  </div>
                  <Badge className={getStatusColor(booking.status)}>
                    {booking.status}
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <span className="truncate">{booking.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <span>{booking.phone_number}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-gray-400" />
                    <span>{booking.number_of_guests} guests</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {getEventTypeLabel(booking.event_type)}
                    </Badge>
                    {booking.is_company_order && (
                      <Badge variant="outline" className="text-xs">
                        <Building className="w-3 h-3 mr-1" />
                        {booking.company_name}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => openBookingDetails(booking)}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Details
                  </Button>
                  {booking.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="text-green-600 hover:bg-green-50"
                        onClick={() => {
                          setSelectedBooking(booking);
                          updateBookingStatus(booking.id, 'contacted');
                        }}
                      >
                        <CheckCircle className="w-4 h-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="text-red-600 hover:bg-red-50"
                        onClick={() => {
                          setSelectedBooking(booking);
                          updateBookingStatus(booking.id, 'rejected');
                        }}
                      >
                        <XCircle className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Booking Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Catering Booking Details
            </DialogTitle>
            <DialogDescription>
              Review and manage this catering booking request
            </DialogDescription>
          </DialogHeader>

          {selectedBooking && (
            <div className="space-y-6">
              {/* Customer Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Customer Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div>
                      <span className="font-medium">Name:</span> {selectedBooking.full_name}
                    </div>
                    <div>
                      <span className="font-medium">Email:</span> {selectedBooking.email}
                    </div>
                    <div>
                      <span className="font-medium">Phone:</span> {selectedBooking.phone_number}
                    </div>
                    {selectedBooking.is_company_order && (
                      <div>
                        <span className="font-medium">Company:</span> {selectedBooking.company_name}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Event Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div>
                      <span className="font-medium">Event Type:</span> {getEventTypeLabel(selectedBooking.event_type)}
                    </div>
                    <div>
                      <span className="font-medium">Date:</span> {format(new Date(selectedBooking.event_date), 'MMMM dd, yyyy')}
                    </div>
                    <div>
                      <span className="font-medium">Guests:</span> {selectedBooking.number_of_guests}
                    </div>
                    <div>
                      <span className="font-medium">Submitted:</span> {format(new Date(selectedBooking.created_at), 'MMM dd, yyyy HH:mm')}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Additional Details */}
              {selectedBooking.additional_details && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Additional Details</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">
                      {selectedBooking.additional_details}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Admin Actions */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Admin Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Quote Amount (₦)</label>
                      <Input
                        type="number"
                        placeholder="Enter quote amount"
                        value={quoteAmount}
                        onChange={(e) => setQuoteAmount(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Status</label>
                      <Select value={selectedBooking.status}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="contacted">Contacted</SelectItem>
                          <SelectItem value="approved">Approved</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Admin Notes</label>
                    <Textarea
                      placeholder="Add notes about this booking..."
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      rows={3}
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button 
                      onClick={() => updateBookingStatus(selectedBooking.id, 'contacted')}
                      disabled={isUpdating}
                      className="flex-1"
                    >
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Mark as Contacted
                    </Button>
                    <Button 
                      onClick={() => updateBookingStatus(selectedBooking.id, 'approved')}
                      disabled={isUpdating}
                      variant="outline"
                      className="flex-1 text-green-600 hover:bg-green-50"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Approve
                    </Button>
                    <Button 
                      onClick={() => updateBookingStatus(selectedBooking.id, 'rejected')}
                      disabled={isUpdating}
                      variant="outline"
                      className="flex-1 text-red-600 hover:bg-red-50"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Reject
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Bookings;