import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load .env.local if present to populate SUPABASE env vars for this script
try {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const contents = fs.readFileSync(envPath, 'utf8');
    for (const line of contents.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx);
      let val = trimmed.slice(idx + 1);
      // remove optional surrounding quotes
      if (val.startsWith("\"") && val.endsWith('\"')) val = val.slice(1, -1);
      // override existing env values with .env.local
      process.env[key] = val;
    }
  }
} catch (e) {
  // ignore
}

function getSupabaseAdmin() {
  const resolvedSupabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const resolvedSupabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  console.log('Using SUPABASE_URL=', resolvedSupabaseUrl);
  console.log('Using SUPABASE_SERVICE_ROLE_KEY=', resolvedSupabaseServiceKey ? String(resolvedSupabaseServiceKey).slice(0,10) + '...' : '<none>');
  if (!resolvedSupabaseUrl) throw new Error('SUPABASE_URL not set');
  if (!resolvedSupabaseServiceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set');
  return createClient(resolvedSupabaseUrl, resolvedSupabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
async function generateGuestId() {
  const timestamp = Date.now().toString().slice(-6);
  const suffix = Math.floor(Math.random() * 90 + 10);
  return `G-${timestamp}${suffix}`;
}

async function main() {
  const supabase = getSupabaseAdmin();
  const staffEmail = 'tptotot20@gmail.com';
  const guestEmail = 'mozep256@gmail.com';
  const results = {};

  // Delete existing staff if any
  const { data: existingStaff, error: esErr } = await supabase.from('staff').select('id,email').eq('email', staffEmail).maybeSingle();
  if (esErr) throw esErr;
  results.existingStaff = existingStaff ?? null;

  if (existingStaff) {
    // find auth user
    const { data: usersData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const authUser = (usersData?.users || []).find(u => (u.email || '').toLowerCase() === staffEmail.toLowerCase());
    if (authUser) {
      // delete profile by auth_id and delete user
      await supabase.from('profiles').delete().eq('auth_id', authUser.id);
      await supabase.auth.admin.deleteUser(authUser.id);
      results.deletedAuthUser = authUser.id;
    } else {
      // delete profile by email
      await supabase.from('profiles').delete().eq('email', staffEmail);
    }

    // delete staff row
    await supabase.from('staff').delete().eq('id', existingStaff.id);
    results.deletedStaffId = existingStaff.id;
  }

  // Recreate staff row
  const employeeCode = 'EMP-RECREATED-001';
  const { data: newStaff, error: newStaffErr } = await supabase.from('staff').insert({
    employee_code: employeeCode,
    full_name: 'tptotot20',
    department: 'Front Office',
    position: 'Receptionist',
    email: staffEmail,
    phone: '(+230) 1234 5678',
    status: 'ACTIVE',
  }).select('*').single();

  if (newStaffErr) throw newStaffErr;
  results.newStaff = newStaff;

  // Invite staff via Supabase auth (server-side)
  const redirectTo = process.env.APP_URL ? `${process.env.APP_URL}/(auth)/reset-password` : 'https://lapirogue-hotel.yunusu.me/reset-password';
  const { data: inviteData, error: inviteErr } = await supabase.auth.admin.inviteUserByEmail(staffEmail, {
    redirectTo,
    data: {
      full_name: 'tptotot20',
      role: 'RECEPTIONIST',
      employee_code: employeeCode,
      login_url: redirectTo,
    },
  });
  if (inviteErr) {
    results.inviteError = inviteErr.message;
  } else {
    results.invite = inviteData?.user ?? null;
  }

  // Create guest
  const guestId = await generateGuestId();
  const { data: newGuest, error: guestErr } = await supabase.from('guests').insert({
    guest_id: guestId,
    first_name: 'Moze',
    last_name: 'P256',
    email: guestEmail,
    phone: null,
    nationality: 'Mauritius',
    passport: 'P256-TEST',
    status: 'RESERVED',
  }).select('*').single();
  if (guestErr) throw guestErr;
  results.newGuest = newGuest;

  console.log('RESULTS', JSON.stringify(results, null, 2));
}

main().catch(err => {
  console.error('Script error', err);
  process.exit(1);
});
