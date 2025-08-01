
import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useBusinessSettings } from '../../hooks/useBusinessSettings';
import { Eye, EyeOff } from 'lucide-react';
import startersLogo from '@/assets/starters-logo.png';

type AuthView = 'sign_in' | 'sign_up' | 'forgot_password';

const LoginPage = () => {
  const { login, signUp, resetPassword, isLoading } = useAuth();
  const { data: settings } = useBusinessSettings();
  const [view, setView] = useState<AuthView>('sign_in');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    
    try {
      await login({ email: formData.email, password: formData.password });
    } catch (err: any) {
      console.error('Auth error:', err);
      setError(err.message || 'An unexpected error occurred.');
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    
    try {
      await signUp({ 
        email: formData.email, 
        password: formData.password, 
        name: formData.name
        // Note: Admin users don't need phone numbers, only customer registrations do
      });
      setMessage('Registration successful! Please check your email for verification.');
      setView('sign_in');
    } catch (err: any) {
      console.error('Signup error:', err);
      setError(err.message || 'Registration failed.');
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

    if (view === 'sign_up') {
      return (
        <>
          <div className="text-center mb-8">
            <div className="w-24 h-24 rounded-full mx-auto mb-4 flex items-center justify-center overflow-hidden bg-white shadow-lg">
              <img 
                src={startersLogo} 
                alt="Starters" 
                className="w-full h-full object-contain p-2"
                loading="lazy"
              />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">Create Admin Account</h1>
            <p className="text-gray-600 mt-2">Set up your dashboard access</p>
          </div>

          <form onSubmit={handleSignUp} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Enter your full name"
                required
              />
            </div>
            
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
                  placeholder="Create a password (min 6 characters)"
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
                {isLoading ? 'Creating Account...' : 'Create Account'}
              </button>
              
              <button
                type="button"
                onClick={() => setView('sign_in')}
                className="w-full text-gray-600 hover:text-gray-800 transition-colors"
              >
                Already have an account? Sign In
              </button>
            </div>
          </form>
        </>
      );
    }

    return (
      <>
        <div className="text-center mb-8">
          <div className="w-24 h-24 rounded-full mx-auto mb-4 flex items-center justify-center overflow-hidden bg-white shadow-lg">
            <img 
              src={startersLogo} 
              alt="Starters" 
              className="w-full h-full object-contain p-2"
              loading="lazy"
            />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Starters</h1>
          <p className="text-gray-600 mt-2">
            Premium Small Chops & Catering Services
          </p>
        </div>

        <form onSubmit={handleSignIn} className="space-y-4">
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
              {isLoading ? 'Signing In...' : 'Sign In'}
            </button>
            
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={() => setView('sign_up')}
                className="flex-1 text-orange-600 hover:text-orange-700 transition-colors text-sm"
              >
                Create Account
              </button>
              <span className="text-gray-300">|</span>
              <button
                type="button"
                onClick={() => setView('forgot_password')}
                className="flex-1 text-orange-600 hover:text-orange-700 transition-colors text-sm"
              >
                Forgot Password?
              </button>
            </div>
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
