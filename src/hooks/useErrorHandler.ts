
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
      } else if (error.message.includes("CORS") || error.message.includes("Failed to fetch")) {
        errorDetails = {
          title: "Connection Error",
          description: "Unable to connect to the server. Please check your internet connection and try again.",
          variant: "destructive",
        };
      } else if (error.message.includes("FunctionsFetchError")) {
        errorDetails = {
          title: "Service Error",
          description: "The requested service is temporarily unavailable. Please try again in a moment.",
          variant: "destructive",
        };
      } else if (error.message.includes("timeout") || error.message.includes("Timeout")) {
        errorDetails = {
          title: "Request Timeout",
          description: "The request took too long to complete. Please try again.",
          variant: "destructive",
        };
      } else if (error.message.includes("rate limit") || error.message.includes("Too many")) {
        errorDetails = {
          title: "Rate Limit Exceeded",
          description: "Too many requests. Please wait a moment before trying again.",
          variant: "destructive",
        };
      } else if (error.message.includes("not found") || error.message.includes("404")) {
        errorDetails = {
          title: "Not Found",
          description: "The requested resource could not be found.",
          variant: "destructive",
        };
      } else if (error.message.includes("permission") || error.message.includes("unauthorized") || error.message.includes("403")) {
        errorDetails = {
          title: "Permission Denied",
          description: "You don't have permission to perform this action.",
          variant: "destructive",
        };
      } else if (error.message.includes("server error") || error.message.includes("500")) {
        errorDetails = {
          title: "Server Error",
          description: "A server error occurred. Please try again later.",
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
