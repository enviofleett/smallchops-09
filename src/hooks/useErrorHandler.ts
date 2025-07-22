
import { useToast } from "@/hooks/use-toast";

interface ErrorDetails {
  title: string;
  description?: string;
  variant?: "default" | "destructive";
}

export const useErrorHandler = () => {
  const { toast } = useToast();

  const handleError = (error: any, context?: string): ErrorDetails => {
    console.error(`Error in ${context}:`, error);

    let errorDetails: ErrorDetails = {
      title: "An error occurred",
      description: "Please try again later",
      variant: "destructive",
    };

    if (error?.message) {
      if (error.message.includes("Access denied")) {
        errorDetails = {
          title: "Access Denied",
          description: "You don't have permission to perform this action. Please contact an administrator.",
          variant: "destructive",
        };
      } else if (error.message.includes("Network")) {
        errorDetails = {
          title: "Network Error",
          description: "Please check your internet connection and try again.",
          variant: "destructive",
        };
      } else if (error.message.includes("Database error")) {
        errorDetails = {
          title: "Database Error",
          description: "There was a problem saving your changes. Please try again.",
          variant: "destructive",
        };
      } else if (error.message.includes("Invalid JSON")) {
        errorDetails = {
          title: "Data Format Error",
          description: "There was a problem with the data format. Please refresh and try again.",
          variant: "destructive",
        };
      } else {
        errorDetails = {
          title: "Error",
          description: error.message,
          variant: "destructive",
        };
      }
    }

    toast(errorDetails);
    return errorDetails;
  };

  const handleSuccess = (message: string, description?: string) => {
    toast({
      title: message,
      description,
      variant: "default",
    });
  };

  return { handleError, handleSuccess };
};
