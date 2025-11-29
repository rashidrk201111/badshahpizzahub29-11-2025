import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { invoiceId } = await req.json();

    if (!invoiceId) {
      throw new Error('Invoice ID is required');
    }

    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select(`
        *,
        customer:customers(*)
      `)
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) {
      throw new Error(`Invoice not found: ${invoiceError?.message}`);
    }

    const { data: companyProfile, error: profileError } = await supabase
      .from('company_profile')
      .select('*')
      .eq('user_id', invoice.created_by)
      .single();

    if (profileError || !companyProfile) {
      throw new Error(`Company profile not found: ${profileError?.message}`);
    }

    if (!invoice.customer.phone) {
      throw new Error('Customer phone number not available');
    }

    const invoiceUrl = `${req.headers.get('origin') || supabaseUrl.replace('/rest/v1', '')}/?id=${invoiceId}`;

    const amount = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(invoice.total);

    const message = `Hello ${invoice.customer.name},\n\nThank you for your payment!\n\nYour invoice ${invoice.invoice_number} for ${amount} has been marked as paid.\n\nYou can view and download your invoice here:\n${invoiceUrl}\n\nThank you for your business!\n\n- ${companyProfile.company_name}`;

    if (companyProfile.whatsapp_api_token && companyProfile.whatsapp_phone_number_id) {
      const customerPhone = invoice.customer.phone.replace(/[^0-9]/g, '');
      
      const whatsappApiUrl = `https://graph.facebook.com/v21.0/${companyProfile.whatsapp_phone_number_id}/messages`;
      
      const whatsappResponse = await fetch(whatsappApiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${companyProfile.whatsapp_api_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: customerPhone,
          type: 'text',
          text: {
            body: message,
          },
        }),
      });

      const whatsappResult = await whatsappResponse.json();

      if (!whatsappResponse.ok) {
        throw new Error(`WhatsApp API error: ${JSON.stringify(whatsappResult)}`);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'WhatsApp message sent successfully',
          messageId: whatsappResult.messages?.[0]?.id,
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    } else {
      const encodedMessage = encodeURIComponent(message);
      const customerPhone = invoice.customer.phone.replace(/[^0-9]/g, '');
      const whatsappUrl = `https://wa.me/${customerPhone}?text=${encodedMessage}`;

      return new Response(
        JSON.stringify({ 
          success: true, 
          whatsappUrl,
          message: 'WhatsApp Business API not configured. Using fallback link.',
          fallback: true,
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
