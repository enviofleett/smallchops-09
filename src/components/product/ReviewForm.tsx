import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StarRating } from '@/components/ui/star-rating';
import { useUnifiedAuth } from '@/hooks/useUnifiedAuth';

interface ReviewFormProps {
  onSubmit: (rating: number, reviewText?: string) => void;
  isSubmitting: boolean;
}

export const ReviewForm: React.FC<ReviewFormProps> = ({ onSubmit, isSubmitting }) => {
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const { isAuthenticated } = useUnifiedAuth();

  if (!isAuthenticated) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <p className="text-muted-foreground">Please sign in to leave a review.</p>
            <Button variant="outline" onClick={() => window.location.href = '/auth'}>
              Sign In
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) return;
    
    onSubmit(rating, reviewText.trim() || undefined);
    
    // Reset form
    setRating(0);
    setReviewText('');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Write a Review</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Your Rating *</label>
            <StarRating
              rating={rating}
              interactive
              onRatingChange={setRating}
              size="lg"
            />
          </div>
          
          <div>
            <label htmlFor="review-text" className="block text-sm font-medium mb-2">
              Your Review (Optional)
            </label>
            <Textarea
              id="review-text"
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="Share your thoughts about this product..."
              rows={4}
              maxLength={1000}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {reviewText.length}/1000 characters
            </p>
          </div>
          
          <Button 
            type="submit" 
            disabled={rating === 0 || isSubmitting}
            className="w-full"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Review'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};