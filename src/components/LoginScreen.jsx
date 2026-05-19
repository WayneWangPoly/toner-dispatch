import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { STAFF, staffEmail } from '../lib/staff';

export default function LoginScreen({ onLogin }) {
  const [name, setName] = useState(STAFF[0]);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handleLogin(e) {
    e.preventDefault();
    setError('');

    const { data, error } = await supabase.auth.signInWithPassword({
      email: staffEmail(name),
      password,
    });

    if (error) {
      setError(error.message);
      return;
    }

    onLogin(data.user, name);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <form onSubmit={handleLogin} className="w-full max-w-sm bg-white rounded-3xl shadow p-6 space-y-4">
        <h1 className="text-2xl font-bold">Toner Dispatch Login</h1>

        <select
          className="w-full border rounded-xl p-3"
          value={name}
          onChange={(e) => setName(e.target.value)}
        >
          {STAFF.map((person) => (
            <option key={person} value={person}>{person}</option>
          ))}
        </select>

        <input
          className="w-full border rounded-xl p-3"
          type="password"
          placeholder="Password is your name"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && <div className="text-red-600 text-sm">{error}</div>}

        <button className="w-full bg-red-600 text-white rounded-xl p-3 font-bold">
          Login
        </button>
      </form>
    </div>
  );
}
