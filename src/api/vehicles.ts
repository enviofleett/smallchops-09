
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";

// Use Supabase generated types
export type Vehicle = Database['public']['Tables']['vehicles']['Row'];
export type NewVehicle = Database['public']['Tables']['vehicles']['Insert'];

export type Assignment = Database['public']['Tables']['vehicle_assignments']['Row'];

export async function getVehicles(): Promise<Vehicle[]> {
  const { data, error } = await supabase.from("vehicles").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createVehicle(vehicle: NewVehicle): Promise<Vehicle> {
  const { data, error } = await supabase.from("vehicles").insert(vehicle).select().single();
  if (error) throw error;
  return data;
}

export async function updateVehicle(id: string, fields: Partial<Vehicle>): Promise<Vehicle> {
  const { data, error } = await supabase.from("vehicles").update(fields).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteVehicle(id: string): Promise<void> {
  const { error } = await supabase.from("vehicles").delete().eq("id", id);
  if (error) throw error;
}

export async function getAssignments(): Promise<Assignment[]> {
  const { data, error } = await supabase.from("vehicle_assignments").select("*").order("assigned_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function assignVehicle(vehicle_id: string, dispatch_rider_id: string, assigned_by?: string, notes?: string) {
  // Mark previous assignments of this vehicle and this rider as inactive
  await supabase
    .from("vehicle_assignments")
    .update({ status: "inactive" })
    .or(`vehicle_id.eq.${vehicle_id},dispatch_rider_id.eq.${dispatch_rider_id}`)
    .eq("status", "active");

  const { data, error } = await supabase.from("vehicle_assignments").insert([
    { vehicle_id, dispatch_rider_id, assigned_by, status: "active", notes }
  ]).select().single();
  if (error) throw error;
  // Update vehicle status
  await supabase.from("vehicles").update({ status: "assigned" }).eq("id", vehicle_id);
  return data;
}

// Unassign: Mark last assignment inactive and vehicle as available
export async function unassignVehicle(vehicle_id: string): Promise<void> {
  await supabase.from("vehicle_assignments").update({ status: "inactive" }).eq("vehicle_id", vehicle_id).eq("status", "active");
  await supabase.from("vehicles").update({ status: "available" }).eq("id", vehicle_id);
}

export async function getDispatchRiders(): Promise<{ id: string, name: string | null }[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name")
    .eq("role", "dispatch_rider")
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}
