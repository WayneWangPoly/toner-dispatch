export const STAFF = [
  'Aaron',
  'Amanda',
  'Bradley',
  'Chen',
  'Henry',
  'Ivan',
  'James',
  'Laurinda',
  'Nikil',
];

export function staffEmail(name) {
  return `${name.toLowerCase()}@toner.local`;
}
import { supabase } from './supabaseClient';
import { staffEmail } from './staff';

export async function loginStaff(name, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: staffEmail(name),
    password,
  });

  if (error) throw error;
  return data.user;
}
const { data: authData } = await supabase.auth.getUser();
const user = authData?.user;

const payload = {
  ...formData,
  created_by: user?.id,
  created_by_name: selectedStaffName,
};

const { error } = await supabase
  .from('dispatch_orders')
  .insert(payload);

if (error) throw error;
const { data } = await supabase.auth.getSession();

if (!data.session) {
  // 显示 Login 页面
} else {
  // 显示 Daily Board
}
await supabase.auth.signOut();
