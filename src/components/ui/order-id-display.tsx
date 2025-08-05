import React from 'react';
import { Hash, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { toast } from '@/hooks/use-toast';

interface OrderIdDisplayProps {
  orderId: string;
  variant?: 'default' | 'compact' | 'prominent' | 'inline';
  showCopy?: boolean;
  showLabel?: boolean;
  className?: string;
}

export function OrderIdDisplay({ 
  orderId, 
  variant = 'default',
  showCopy = false,
  showLabel = true,
  className 
}: OrderIdDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(orderId);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Order ID copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Failed to copy order ID",
        variant: "destructive",
      });
    }
  };

  if (variant === 'compact') {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Hash className="w-3 h-3 text-muted-foreground" />
        <span className="text-sm font-mono">{orderId}</span>
        {showCopy && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-6 w-6 p-0"
          >
            {copied ? (
              <Check className="w-3 h-3 text-green-600" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
          </Button>
        )}
      </div>
    );
  }

  if (variant === 'prominent') {
    return (
      <div className={cn("bg-primary/10 rounded-lg p-4 text-center", className)}>
        <div className="flex items-center justify-center gap-2 mb-2">
          <Hash className="w-5 h-5 text-primary" />
          {showLabel && (
            <span className="text-sm font-medium text-muted-foreground">Order ID</span>
          )}
        </div>
        <div className="flex items-center justify-center gap-2">
          <span className="text-xl font-bold text-primary font-mono">{orderId}</span>
          {showCopy && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-8 w-8 p-0"
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-600" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <span className={cn("inline-flex items-center gap-1", className)}>
        {showLabel && <span className="text-sm">Order ID:</span>}
        <span className="font-mono font-medium">{orderId}</span>
        {showCopy && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-5 w-5 p-0 ml-1"
          >
            {copied ? (
              <Check className="w-3 h-3 text-green-600" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
          </Button>
        )}
      </span>
    );
  }

  // Default variant
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Hash className="w-4 h-4 text-muted-foreground" />
      {showLabel && (
        <span className="text-sm font-medium">Order ID:</span>
      )}
      <Badge variant="outline" className="font-mono">
        {orderId}
      </Badge>
      {showCopy && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-6 w-6 p-0"
        >
          {copied ? (
            <Check className="w-3 h-3 text-green-600" />
          ) : (
            <Copy className="w-3 h-3" />
          )}
        </Button>
      )}
    </div>
  );
}