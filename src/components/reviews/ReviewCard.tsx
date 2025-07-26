import { useState } from 'react';
import { format } from 'date-fns';
import { ThumbsUp, ThumbsDown, Shield, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StarRating } from '@/components/ui/star-rating';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import type { ProductReview } from '@/api/reviews';
import { voteOnReview } from '@/api/reviews';
import { useToast } from '@/hooks/use-toast';

interface ReviewCardProps {
  review: ProductReview;
  onVoteUpdate?: () => void;
  showProduct?: boolean;
}

export const ReviewCard = ({ review, onVoteUpdate, showProduct = false }: ReviewCardProps) => {
  const [isVoting, setIsVoting] = useState(false);
  const { toast } = useToast();

  const handleVote = async (voteType: 'helpful' | 'not_helpful') => {
    try {
      setIsVoting(true);
      await voteOnReview(review.id, voteType);
      toast({
        title: 'Vote recorded',
        description: 'Thank you for your feedback!',
      });
      onVoteUpdate?.();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to record vote',
        variant: 'destructive',
      });
    } finally {
      setIsVoting(false);
    }
  };

  const customerName = review.customer_accounts?.name || review.customer_email;
  const initials = customerName
    .split(' ')
    .map((name) => name[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{customerName}</span>
                {review.is_verified_purchase && (
                  <Badge variant="secondary" className="text-xs">
                    <Shield className="w-3 h-3 mr-1" />
                    Verified Purchase
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <StarRating rating={review.rating} size="sm" />
                <span className="text-sm text-muted-foreground">
                  {format(new Date(review.created_at), 'MMM d, yyyy')}
                </span>
              </div>
            </div>
          </div>
          
          {showProduct && review.products && (
            <div className="text-right">
              <p className="text-sm font-medium">{review.products.name}</p>
            </div>
          )}
        </div>

        {review.title && (
          <h4 className="font-medium mt-3">{review.title}</h4>
        )}
      </CardHeader>

      <CardContent className="pt-0">
        {review.content && (
          <p className="text-muted-foreground mb-4">{review.content}</p>
        )}

        {/* Business Response */}
        {review.review_responses && review.review_responses.length > 0 && (
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <MessageCircle className="w-4 h-4" />
              <span className="text-sm font-medium">Business Response</span>
            </div>
            {review.review_responses.map((response) => (
              <div key={response.id}>
                <p className="text-sm">{response.response_content}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {format(new Date(response.created_at), 'MMM d, yyyy')}
                </p>
              </div>
            ))}
          </div>
        )}

        <Separator className="my-4" />

        {/* Helpfulness Voting */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleVote('helpful')}
              disabled={isVoting}
              className="text-sm"
            >
              <ThumbsUp className="w-4 h-4 mr-1" />
              Helpful ({review.helpful_votes})
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleVote('not_helpful')}
              disabled={isVoting}
              className="text-sm"
            >
              <ThumbsDown className="w-4 h-4 mr-1" />
              Not helpful
            </Button>
          </div>
          
          {review.total_votes > 0 && (
            <span className="text-xs text-muted-foreground">
              {review.helpful_votes} of {review.total_votes} found this helpful
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
};