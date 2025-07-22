
import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Eye, EyeOff, UserPlus } from 'lucide-react';

type AuthView = 'sign_in' | 'sign_up' | 'forgot_password';

const LoginPage = () => {
  const { login, signUp, resetPassword, isLoading } = useAuth();
  const [view, setView] = useState<AuthView>('sign_in');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleAuthAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    
    try {
      if (view === 'sign_in') {
        await login({ email: formData.email, password: formData.password });
      } else if (view === 'sign_up') {
        await signUp({ name: formData.name, email: formData.email, password: formData.password });
        setMessage('Account created! Please check your email for verification link.');
        setView('sign_in');
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      setError(err.message || 'An unexpected error occurred.');
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      await resetPassword(formData.email);
      setMessage('Password reset email sent!');
      setView('sign_in');
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email');
    }
  };

  const createFirstAdmin = () => {
    setView('sign_up');
    setFormData(prev => ({ ...prev, name: 'System Admin' }));
    setMessage('Creating your first admin account. You will have admin privileges.');
  };

  const renderForm = () => {
    if (view === 'forgot_password') {
      return (
        <>
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-800">Reset Password</h1>
            <p className="text-gray-600 mt-2">Enter your email to receive reset instructions</p>
          </div>
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                required
              />
            </div>
            <div className="space-y-3 pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-orange-600 text-white py-3 rounded-xl hover:bg-orange-700 transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Sending...' : 'Send Reset Email'}
              </button>
              <button
                type="button"
                onClick={() => setView('sign_in')}
                className="w-full text-gray-600 hover:text-gray-800 transition-colors"
              >
                Back to Sign In
              </button>
            </div>
          </form>
        </>
      );
    }

    return (
      <>
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-orange-100 rounded-full mx-auto mb-4 flex items-center justify-center">
            <span className="text-2xl">🍽️</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Starters Smallchops</h1>
          <p className="text-gray-600 mt-2">
            {view === 'sign_in' ? 'Admin Dashboard' : 'Create an Account'}
          </p>
        </div>

        {view === 'sign_in' && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <p className="text-sm text-blue-800 mb-3">
              Need to set up your first admin account?
            </p>
            <button
              onClick={createFirstAdmin}
              className="flex items-center space-x-2 w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              <UserPlus className="h-4 w-4" />
              <span>Create First Admin Account</span>
            </button>
          </div>
        )}

        <form onSubmit={handleAuthAction} className="space-y-4">
          {view === 'sign_up' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Your Name"
                required
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="admin@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Enter your password"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-orange-600 text-white py-3 rounded-xl hover:bg-orange-700 transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Processing...' : (view === 'sign_in' ? 'Sign In' : 'Create Admin Account')}
            </button>
            
            {view === 'sign_in' && (
              <button
                type="button"
                onClick={() => setView('forgot_password')}
                className="w-full text-orange-600 hover:text-orange-700 transition-colors"
              >
                Forgot Password?
              </button>
            )}

            {view !== 'sign_up' && (
              <p className="text-center text-sm text-gray-600">
                Don't have an account?
                <button
                  type="button"
                  onClick={() => setView('sign_up')}
                  className="font-medium text-orange-600 hover:text-orange-700 ml-1"
                >
                  Sign Up
                </button>
              </p>
            )}

            {view === 'sign_up' && (
              <button
                type="button"
                onClick={() => setView('sign_in')}
                className="w-full text-gray-600 hover:text-gray-800 transition-colors"
              >
                Back to Sign In
              </button>
            )}
          </div>
        </form>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm mb-4">
            {error}
          </div>
        )}
        {message && (
          <div className="bg-green-50 text-green-600 p-3 rounded-xl text-sm mb-4">
            {message}
          </div>
        )}
        {renderForm()}
      </div>
    </div>
  );
};

export default LoginPage;
