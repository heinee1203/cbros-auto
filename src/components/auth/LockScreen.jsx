import { useState, useRef, useEffect } from 'react';
import { Lock, LogOut, KeyRound, Eye, EyeOff, AlertCircle, X, Settings } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

export default function LockScreen() {
  const user = useAuthStore((s) => s.user);
  const lockPin = useAuthStore((s) => s.lockPin);
  const unlockWithPin = useAuthStore((s) => s.unlockWithPin);
  const unlockWithPassword = useAuthStore((s) => s.unlockWithPassword);
  const logout = useAuthStore((s) => s.logout);
  const setLockPin = useAuthStore((s) => s.setLockPin);

  const [mode, setMode] = useState(lockPin ? 'pin' : 'password');
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showSetPin, setShowSetPin] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');

  const inputRef = useRef(null);

  // Auto-focus on mode change
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [mode, showSetPin]);

  const handleUnlock = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'pin') {
        const success = unlockWithPin(value);
        if (!success) {
          setError('Incorrect PIN');
          setValue('');
        }
      } else {
        await unlockWithPassword(value);
      }
    } catch (err) {
      setError('Incorrect password');
      setValue('');
    } finally {
      setLoading(false);
    }
  };

  const handleSetPin = (e) => {
    e.preventDefault();
    setPinError('');
    if (newPin.length < 4 || newPin.length > 6) {
      setPinError('PIN must be 4-6 digits');
      return;
    }
    if (newPin !== confirmPin) {
      setPinError('PINs do not match');
      return;
    }
    setLockPin(newPin);
    setShowSetPin(false);
    setMode('pin');
    setValue('');
    setNewPin('');
    setConfirmPin('');
  };

  // Live clock (PST)
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const formattedTime = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(time);

  const formattedDate = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(time);

  // ── Set PIN overlay ──────────────────────────────────────────────────────
  if (showSetPin) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ background: 'rgba(3,7,18,0.97)' }}>
        <div className="w-full max-w-sm mx-4">
          <div className="bg-gray-800 rounded-2xl border border-gray-700 p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-400" />
                {lockPin ? 'Change PIN' : 'Set Quick PIN'}
              </h3>
              <button
                onClick={() => { setShowSetPin(false); setNewPin(''); setConfirmPin(''); setPinError(''); }}
                className="p-1 text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-gray-400 mb-4">
              Set a 4-6 digit PIN for quick unlock when the screen is locked.
            </p>

            {pinError && (
              <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-red-900/30 border border-red-800 text-sm text-red-300">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {pinError}
              </div>
            )}

            <form onSubmit={handleSetPin} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-1.5">New PIN</label>
                <input
                  ref={inputRef}
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter 4-6 digit PIN"
                  className="w-full px-4 py-3 text-center text-xl font-mono tracking-[0.3em] rounded-lg border border-gray-600 bg-gray-900 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-1.5">Confirm PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="Confirm PIN"
                  className="w-full px-4 py-3 text-center text-xl font-mono tracking-[0.3em] rounded-lg border border-gray-600 bg-gray-900 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                type="submit"
                disabled={newPin.length < 4}
                className="w-full py-3 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:pointer-events-none transition-colors"
              >
                Save PIN
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ── Main Lock Screen ─────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center" style={{ background: 'rgba(3,7,18,0.97)' }}>
      {/* Time Display */}
      <div className="text-center mb-8">
        <p className="text-6xl font-light text-white tracking-tight">{formattedTime}</p>
        <p className="text-sm text-gray-400 mt-2">{formattedDate}</p>
      </div>

      {/* Lock Icon */}
      <div className="w-16 h-16 rounded-full bg-gray-800 border-2 border-gray-600 flex items-center justify-center mb-4">
        <Lock className="w-7 h-7 text-gray-300" />
      </div>

      {/* User Email */}
      <p className="text-sm text-gray-400 mb-6">{user?.email}</p>

      {/* Unlock Form */}
      <div className="w-full max-w-xs mx-4">
        {error && (
          <div className="flex items-center justify-center gap-2 p-2 mb-4 rounded-lg bg-red-900/30 border border-red-800 text-sm text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleUnlock}>
          {mode === 'pin' ? (
            <input
              ref={inputRef}
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={value}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '');
                setValue(v);
                if (error) setError('');
              }}
              placeholder="Enter PIN"
              className="w-full px-4 py-3 text-center text-2xl font-mono tracking-[0.4em] rounded-lg border border-gray-600 bg-gray-800 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            />
          ) : (
            <div className="relative">
              <input
                ref={inputRef}
                type={showPassword ? 'text' : 'password'}
                value={value}
                onChange={(e) => { setValue(e.target.value); if (error) setError(''); }}
                placeholder="Enter password"
                className="w-full px-4 py-3 pr-11 rounded-lg border border-gray-600 bg-gray-800 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !value}
            className="w-full mt-3 flex items-center justify-center gap-2 py-3 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:pointer-events-none transition-colors"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <KeyRound className="w-4 h-4" />
            )}
            {loading ? 'Verifying...' : 'Unlock'}
          </button>
        </form>

        {/* Mode toggle & actions */}
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={() => { setMode(mode === 'pin' && lockPin ? 'password' : 'pin'); setValue(''); setError(''); }}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            style={{ visibility: (mode === 'pin' || lockPin) ? 'visible' : 'hidden' }}
          >
            {mode === 'pin' ? 'Use Password' : 'Use PIN'}
          </button>

          <button
            onClick={() => setShowSetPin(true)}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            {lockPin ? 'Change PIN' : 'Set PIN'}
          </button>
        </div>

        {/* Sign Out */}
        <button
          onClick={logout}
          className="w-full mt-6 flex items-center justify-center gap-2 py-2 text-xs text-gray-500 hover:text-red-400 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign Out
        </button>
      </div>

      {/* Session preserved notice */}
      <p className="absolute bottom-6 text-[10px] text-gray-600">
        Session preserved &mdash; screen locked due to inactivity
      </p>
    </div>
  );
}
