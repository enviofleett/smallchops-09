
import { supabase } from "@/integrations/supabase/client";

/**
 * API utility for fetching analytics data from the Supabase reports Edge Function.
 */
export async function fetchReportsData() {
  try {
    console.log("Fetching reports data...");
    
    // Get the current session for authentication
    const { data: { session } } = await supabase.auth.getSession();
    
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    
    // Add authorization header if user is authenticated
    if (session?.access_token) {
      headers.authorization = `Bearer ${session.access_token}`;
      console.log("Adding authorization header");
    } else {
      console.warn("No session found, proceeding without authentication");
    }
    
    const res = await fetch("https://lpcviyjdsgghvuddthxr.functions.supabase.co/reports", {
      method: "GET",
      headers
    });
    
    console.log("Response status:", res.status);
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error("Reports API error:", res.status, errorText);
      throw new Error(`HTTP ${res.status}: ${errorText || "Failed to fetch reports data"}`);
    }
    
    const json = await res.json();
    console.log("Reports data received:", json);
    
    if (json.error) {
      console.error("Reports API returned error:", json.error);
      throw new Error(json.error);
    }
    
    return json.data;
  } catch (error) {
    console.error("Failed to fetch reports data:", error);
    throw error;
  }
}
