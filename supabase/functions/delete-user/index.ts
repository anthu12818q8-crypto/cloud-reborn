import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Validate Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing or invalid authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify the JWT and get claims
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminUserId = claimsData.claims.sub;

    // Check if user has admin role using the database function
    const { data: hasAdminRole, error: roleError } = await supabaseAdmin
      .rpc('has_role', { _user_id: adminUserId, _role: 'admin' });

    if (roleError || !hasAdminRole) {
      // Log unauthorized access attempt
      await supabaseAdmin.rpc('log_security_event', {
        p_action: 'UNAUTHORIZED_DELETE_ATTEMPT',
        p_resource_type: 'user',
        p_metadata: { attempted_by: adminUserId }
      });
      
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate request body
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid request body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { userId } = body;
    
    // Validate userId format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!userId || typeof userId !== 'string' || !uuidRegex.test(userId)) {
      return new Response(JSON.stringify({ error: 'Valid User ID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Prevent self-deletion
    if (userId === adminUserId) {
      return new Response(JSON.stringify({ error: 'Cannot delete yourself' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Prevent deleting other admins
    const { data: targetIsAdmin } = await supabaseAdmin
      .rpc('has_role', { _user_id: userId, _role: 'admin' });
    
    if (targetIsAdmin) {
      await supabaseAdmin.rpc('log_security_event', {
        p_action: 'ADMIN_DELETE_BLOCKED',
        p_resource_type: 'user',
        p_resource_id: userId,
        p_metadata: { attempted_by: adminUserId }
      });
      
      return new Response(JSON.stringify({ error: 'Cannot delete admin users' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Log the deletion action
    await supabaseAdmin.rpc('log_security_event', {
      p_action: 'USER_DELETED',
      p_resource_type: 'user',
      p_resource_id: userId,
      p_metadata: { deleted_by: adminUserId }
    });

    // Delete user from auth.users (this will cascade to profiles via trigger or RLS)
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteError) {
      throw deleteError;
    }

    // Clean up related data (in case cascades don't cover everything)
    await Promise.all([
      supabaseAdmin.from('user_device_info').delete().eq('user_id', userId),
      supabaseAdmin.from('favorites').delete().eq('user_id', userId),
      supabaseAdmin.from('watch_history').delete().eq('user_id', userId),
      supabaseAdmin.from('comments').delete().eq('user_id', userId),
      supabaseAdmin.from('payment_requests').delete().eq('user_id', userId),
      supabaseAdmin.from('notifications').delete().eq('user_id', userId),
      supabaseAdmin.from('user_roles').delete().eq('user_id', userId),
      supabaseAdmin.from('profiles').delete().eq('id', userId),
    ]);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    // Don't expose internal error details
    const isDev = Deno.env.get('ENVIRONMENT') === 'development';
    const message = isDev && error instanceof Error ? error.message : 'Internal server error';
    
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
