import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DriverInvitationRequest {
  driverData: {
    name: string;
    email: string;
    phone: string;
    license_number?: string;
    vehicle_type: 'car' | 'motorcycle' | 'bicycle' | 'van';
    vehicle_brand?: string;
    vehicle_model?: string;
    license_plate?: string;
    is_active?: boolean;
  };
  sendInvitation: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  console.log('📧 Dispatch driver invitation function called');
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Authenticate the user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('❌ No authorization header found');
      return new Response(JSON.stringify({ error: 'Authorization required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('❌ Authentication failed:', authError);
      return new Response(JSON.stringify({ error: 'Invalid authentication' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { driverData, sendInvitation }: DriverInvitationRequest = await req.json();
    
    console.log('📋 Creating driver with data:', { 
      name: driverData.name, 
      email: driverData.email,
      sendInvitation 
    });

    // Call the enhanced database function
    const { data: result, error: dbError } = await supabase.rpc('create_driver_with_profile', {
      p_driver_data: driverData,
      p_create_profile: false, // We'll handle this separately
      p_send_invitation: sendInvitation
    });

    if (dbError) {
      console.error('❌ Database error:', dbError);
      return new Response(JSON.stringify({ error: dbError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('✅ Driver created:', result);

    // Send invitation email if requested and email provided
    if (sendInvitation && driverData.email) {
      try {
        // Get the invitation token from the database
        const { data: invitation, error: inviteError } = await supabase
          .from('driver_invitations')
          .select('invitation_token, expires_at')
          .eq('email', driverData.email)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (!inviteError && invitation) {
          const setupUrl = `${Deno.env.get('SUPABASE_URL')}/auth/v1/verify?token=${invitation.invitation_token}&type=driver_setup&redirect_to=${Deno.env.get('SUPABASE_URL')}/auth/driver-setup`;

          const emailResponse = await resend.emails.send({
            from: "Dispatch Team <dispatch@startersmallchops.com>",
            to: [driverData.email],
            subject: "Welcome to Our Dispatch Team! 🚗",
            html: `
              <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
                <div style="background: white; border-radius: 12px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                  <div style="text-align: center; margin-bottom: 32px;">
                    <h1 style="color: #1f2937; font-size: 28px; font-weight: bold; margin: 0;">
                      Welcome to the Team! 🎉
                    </h1>
                    <p style="color: #6b7280; font-size: 16px; margin: 8px 0 0 0;">
                      You've been invited to join our dispatch rider team
                    </p>
                  </div>

                  <div style="background: #f3f4f6; border-radius: 8px; padding: 24px; margin: 24px 0;">
                    <h2 style="color: #374151; font-size: 18px; margin: 0 0 12px 0;">
                      Hi ${driverData.name},
                    </h2>
                    <p style="color: #4b5563; line-height: 1.6; margin: 0;">
                      You've been registered as a dispatch rider with us! To complete your setup and start receiving delivery assignments, please click the button below to create your account.
                    </p>
                  </div>

                  <div style="text-align: center; margin: 32px 0;">
                    <a href="${setupUrl}" 
                       style="display: inline-block; background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; transition: all 0.2s;">
                      Complete Your Setup
                    </a>
                  </div>

                  <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 24px 0;">
                    <h3 style="color: #92400e; font-size: 14px; font-weight: 600; margin: 0 0 8px 0;">
                      ⏰ Important: This invitation expires in 7 days
                    </h3>
                    <p style="color: #92400e; font-size: 14px; margin: 0; line-height: 1.4;">
                      Please complete your setup before ${new Date(invitation.expires_at).toLocaleDateString()}.
                    </p>
                  </div>

                  <div style="border-top: 1px solid #e5e7eb; padding-top: 24px; margin-top: 32px;">
                    <h3 style="color: #374151; font-size: 16px; margin: 0 0 16px 0;">
                      What happens next?
                    </h3>
                    <ol style="color: #4b5563; line-height: 1.6; padding-left: 20px;">
                      <li>Click the setup button above</li>
                      <li>Create your secure password</li>
                      <li>Complete your profile information</li>
                      <li>Start receiving delivery assignments!</li>
                    </ol>
                  </div>

                  <div style="text-align: center; margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
                    <p style="color: #6b7280; font-size: 14px; margin: 0;">
                      Need help? Contact our dispatch team at 
                      <a href="mailto:dispatch@startersmallchops.com" style="color: #3b82f6;">dispatch@startersmallchops.com</a>
                    </p>
                  </div>
                </div>
              </div>
            `,
          });

          console.log('📧 Invitation email sent:', emailResponse);
        }
      } catch (emailError) {
        console.error('📧 Email sending failed:', emailError);
        // Don't fail the entire operation if email fails
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Driver created successfully',
      driverId: result.driver_id,
      invitationSent: result.invitation_sent || false
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('❌ Error in dispatch driver invitation function:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

serve(handler);