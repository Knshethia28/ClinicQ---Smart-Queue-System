import React, { useEffect, useState } from 'react';
import { Dashboard } from './components/ClinicDashboard';
import { PatientDashboard } from './components/PatientDashboard';
import { Button, Input, Label, Card, CardContent, CardDescription, CardHeader, CardTitle, Alert, AlertDescription, Tabs, TabsContent, TabsList, TabsTrigger } from './ui';
import { Stethoscope, Lock, User, Mail, Building, Phone, Calendar, MapPin, Clock, Heart, CheckCircle2, ArrowRight } from 'lucide-react';

interface LoginProps {
  onLogin: (username: string, password: string) => Promise<boolean>;
  onSignUp: (userData: {
    username: string;
    password: string;
    email: string;
    role: 'clinic' | 'patient';
    clinicName?: string;
    facilityType?: 'clinic' | 'hospital';
    address?: string;
    contactNumber?: string;
    operatingHours?: string;
    fullName?: string;
    phone?: string;
    dateOfBirth?: string;
  }) => Promise<{ success: boolean; message: string }>;
}

function Login({ onLogin, onSignUp }: LoginProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [selectedRole, setSelectedRole] = useState<'clinic' | 'patient'>('clinic');
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    email: '',
    // Clinic fields
    clinicName: '',
    facilityType: 'clinic',
    address: '',
    contactNumber: '',
    operatingHours: '',
    // Patient fields
    fullName: '',
    phone: '',
    dateOfBirth: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
    setSuccess('');
  };

  const handleRoleChange = (role: 'clinic' | 'patient') => {
    setSelectedRole(role);
    setFormData({
      username: '',
      password: '',
      confirmPassword: '',
      email: '',
      clinicName: '',
      facilityType: 'clinic',
      address: '',
      contactNumber: '',
      operatingHours: '',
      fullName: '',
      phone: '',
      dateOfBirth: ''
    });
    setError('');
    setSuccess('');
  };

  const validateSignUp = () => {
    if (!formData.username.trim()) return 'Username is required';
    if (formData.username.length < 3) return 'Username must be at least 3 characters';
    if (!formData.password) return 'Password is required';
    if (formData.password.length < 6) return 'Password must be at least 6 characters';
    if (formData.password !== formData.confirmPassword) return 'Passwords do not match';
    if (!formData.email.trim()) return 'Email is required';
    if (!/\S+@\S+\.\S+/.test(formData.email)) return 'Email is invalid';

    if (selectedRole === 'clinic') {
      if (!formData.clinicName.trim()) return 'Clinic name is required';
      if (!formData.address.trim()) return 'Address is required';
      if (!formData.contactNumber.trim()) return 'Contact number is required';
      if (!formData.operatingHours.trim()) return 'Operating hours are required';
    } else {
      if (!formData.fullName.trim()) return 'Full name is required';
      if (!formData.phone.trim()) return 'Phone number is required';
      if (!formData.dateOfBirth) return 'Date of birth is required';
    }
    
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    // Simulate loading
    await new Promise(resolve => setTimeout(resolve, 500));

    if (mode === 'login') {
      const success = await onLogin(formData.username, formData.password);
      if (!success) {
        setError('Invalid login credentials. Please try again.');
      }
    } else {
      const validationError = validateSignUp();
      if (validationError) {
        setError(validationError);
        setIsLoading(false);
        return;
      }

      const result = await onSignUp({
        username: formData.username,
        password: formData.password,
        email: formData.email,
        role: selectedRole,
        ...(selectedRole === 'clinic' ? {
          clinicName: formData.clinicName,
          facilityType: (formData.facilityType as 'clinic' | 'hospital') || 'clinic',
          address: formData.address,
          contactNumber: formData.contactNumber,
          operatingHours: formData.operatingHours
        } : {
          fullName: formData.fullName,
          phone: formData.phone,
          dateOfBirth: formData.dateOfBirth
        })
      });

      if (!result.success) {
        setError(result.message);
      } else {
        setSuccess(result.message);
      }
    }

    setIsLoading(false);
  };

  const toggleMode = () => {
    setMode(mode === 'login' ? 'signup' : 'login');
    setFormData({
      username: '',
      password: '',
      confirmPassword: '',
      email: '',
      clinicName: '',
      facilityType: 'clinic',
      address: '',
      contactNumber: '',
      operatingHours: '',
      fullName: '',
      phone: '',
      dateOfBirth: ''
    });
    setError('');
    setSuccess('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden font-sans selection:bg-teal-500/30 bg-gradient-to-br from-[#020617] via-[#0a1628] to-[#0f172a]">
      {/* Animated Mesh Background - boosted visibility */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <div className="absolute -top-[25%] -left-[25%] w-[70%] h-[70%] rounded-full bg-teal-600/25 blur-[120px] animate-pulse-slow"></div>
        <div className="absolute -bottom-[25%] -right-[25%] w-[70%] h-[70%] rounded-full bg-indigo-600/20 blur-[120px] animate-pulse-slow" style={{ animationDelay: '-5s' }}></div>
        <div className="absolute top-[40%] left-[50%] -translate-x-1/2 w-[50%] h-[50%] rounded-full bg-cyan-700/15 blur-[100px] animate-pulse-slow" style={{ animationDelay: '-3s' }}></div>
      </div>
      
      {/* Subtle Grid Overlay */}
      <div className="absolute inset-0 z-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '40px 40px' }}></div>

      <div className="w-full max-w-[440px] relative z-10 animate-slide-up">
        {/* Elegant Logo Section */}
        <div className="text-center mb-10">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-teal-500/10 backdrop-blur-3xl rounded-3xl border border-teal-500/20 shadow-[0_0_50px_-12px_rgba(20,184,166,0.3)] animate-float">
              <Stethoscope className="w-10 h-10 text-teal-400" />
            </div>
          </div>
          <h1 className="text-5xl font-black text-white mb-2 tracking-tight font-heading leading-tight">ClinicQ</h1>
          <p className="text-slate-400 font-medium tracking-wide">Premium Healthcare Flow Platform</p>
        </div>

        {/* Modern Auth Card */}
        <Card className="glass-premium border-white/5 shadow-2xl overflow-hidden bg-slate-900/40 backdrop-blur-3xl">
          <CardHeader className="space-y-2 pb-8 pt-8 border-b border-white/5 bg-white/[0.02]">
            <CardTitle className="text-3xl text-center text-white font-heading font-bold tracking-tight">
              {mode === 'login' ? 'Welcome Back' : 'Get Started'}
            </CardTitle>
            <CardDescription className="text-center text-slate-400 font-medium">
              {mode === 'login' 
                ? 'Access your healthcare portal'
                : 'Create your professional account'
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-8 pb-10 px-10">
            {mode === 'signup' && (
              <Tabs value={selectedRole} onValueChange={handleRoleChange as any} className="mb-8">
                <TabsList className="grid w-full grid-cols-2 p-1.5 bg-black/40 rounded-2xl h-14 border border-white/5">
                  <TabsTrigger value="clinic" className="text-sm font-bold rounded-xl active:text-teal-400 data-[state=active]:bg-white/10 transition-all">Clinic Admin</TabsTrigger>
                  <TabsTrigger value="patient" className="text-sm font-bold rounded-xl active:text-teal-400 data-[state=active]:bg-white/10 transition-all">Patient</TabsTrigger>
                </TabsList>
              </Tabs>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <Alert variant="destructive" className="border-red-200/50 bg-red-50/80 dark:bg-red-950/30 rounded-xl animate-fade-in">
                  <AlertDescription className="text-red-800 dark:text-red-200 text-sm font-medium">
                    {error}
                  </AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert className="border-green-200/50 bg-green-50/80 dark:bg-green-950/30 rounded-xl animate-fade-in">
                  <AlertDescription className="text-green-800 dark:text-green-200 text-sm font-medium">
                    {success}
                  </AlertDescription>
                </Alert>
              )}

              {mode === 'signup' && selectedRole === 'clinic' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="clinicName" className="text-slate-700 dark:text-slate-200 font-semibold text-xs ml-1 uppercase tracking-wider opacity-70">Clinic Name</Label>
                    <div className="relative group">
                      <Building className="absolute left-4 top-3 h-4 w-4 text-slate-400 group-focus-within:text-teal-500 transition-colors" />
                      <Input
                        id="clinicName"
                        type="text"
                        placeholder="Enter your clinic name"
                        value={formData.clinicName}
                        onChange={(e) => handleInputChange('clinicName', e.target.value)}
                        className="pl-11 h-11 bg-slate-50/50 dark:bg-black/20 border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-teal-500/50 transition-all font-medium"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="facilityType" className="text-gray-700">Facility Type</Label>
                    <select
                      id="facilityType"
                      title="Facility Type"
                      value={formData.facilityType}
                      onChange={(e) => handleInputChange('facilityType', e.target.value)}
                      className="w-full h-10 rounded-md border border-gray-200 bg-white px-3 text-sm focus:border-teal-500 focus:outline-none"
                    >
                      <option value="clinic">Clinic</option>
                      <option value="hospital">Hospital</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address" className="text-gray-700">Address</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="address"
                        type="text"
                        placeholder="Enter clinic address"
                        value={formData.address}
                        onChange={(e) => handleInputChange('address', e.target.value)}
                        className="pl-10 border-gray-200 focus:border-teal-500 focus:ring-teal-500"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contactNumber" className="text-gray-700">Contact Number</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="contactNumber"
                        type="tel"
                        placeholder="Enter clinic phone number"
                        value={formData.contactNumber}
                        onChange={(e) => handleInputChange('contactNumber', e.target.value)}
                        className="pl-10 border-gray-200 focus:border-teal-500 focus:ring-teal-500"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="operatingHours" className="text-gray-700">Operating Hours</Label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="operatingHours"
                        type="text"
                        placeholder="e.g., Mon-Fri: 9AM-6PM"
                        value={formData.operatingHours}
                        onChange={(e) => handleInputChange('operatingHours', e.target.value)}
                        className="pl-10 border-gray-200 focus:border-teal-500 focus:ring-teal-500"
                        required
                      />
                    </div>
                  </div>

                </>
              )}

              {mode === 'signup' && selectedRole === 'patient' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="fullName" className="text-gray-700">Full Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="fullName"
                        type="text"
                        placeholder="Enter your full name"
                        value={formData.fullName}
                        onChange={(e) => handleInputChange('fullName', e.target.value)}
                        className="pl-10 border-gray-200 focus:border-teal-500 focus:ring-teal-500"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-gray-700">Phone Number</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="Enter your phone number"
                        value={formData.phone}
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                        className="pl-10 border-gray-200 focus:border-teal-500 focus:ring-teal-500"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dateOfBirth" className="text-gray-700">Date of Birth</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="dateOfBirth"
                        type="date"
                        value={formData.dateOfBirth}
                        onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                        className="pl-10 border-gray-200 focus:border-teal-500 focus:ring-teal-500"
                        required
                      />
                    </div>
                  </div>
                </>
              )}

              {mode === 'signup' && (
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-gray-700">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter your email address"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      className="pl-10 border-gray-200 focus:border-teal-500 focus:ring-teal-500"
                      required
                    />
                  </div>
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="username" className="text-slate-700 dark:text-slate-200 font-semibold text-xs ml-1 uppercase tracking-wider opacity-70">Username</Label>
                <div className="relative group">
                  <User className="absolute left-4 top-3.5 h-4 w-4 text-slate-400 group-focus-within:text-teal-500 transition-colors" />
                  <Input
                    id="username"
                    type="text"
                    placeholder="Enter your username"
                    value={formData.username}
                    onChange={(e) => handleInputChange('username', e.target.value)}
                    className="pl-11 h-12 bg-slate-50/50 dark:bg-black/20 border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-teal-500/50 transition-all font-medium"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-700 dark:text-slate-200 font-semibold text-xs ml-1 uppercase tracking-wider opacity-70">Password</Label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-3.5 h-4 w-4 text-slate-400 group-focus-within:text-teal-500 transition-colors" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    className="pl-11 h-12 bg-slate-50/50 dark:bg-black/20 border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-teal-500/50 transition-all font-medium"
                    required
                  />
                </div>
              </div>

              {mode === 'signup' && (
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-slate-700 dark:text-slate-200 font-semibold text-xs ml-1 uppercase tracking-wider opacity-70">Confirm Password</Label>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-3.5 h-4 w-4 text-slate-400 group-focus-within:text-teal-500 transition-colors" />
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="Confirm your password"
                      value={formData.confirmPassword}
                      onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                      className="pl-11 h-12 bg-slate-50/50 dark:bg-black/20 border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-teal-500/50 transition-all font-medium"
                      required
                    />
                  </div>
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-14 bg-teal-600 hover:bg-teal-500 text-white font-bold text-lg rounded-2xl shadow-xl shadow-teal-500/20 hover:shadow-teal-500/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 mt-6"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin mr-3"></div>
                    <span>{mode === 'login' ? 'Authenticating...' : 'Registering...'}</span>
                  </div>
                ) : (
                  <span className="flex items-center">
                    {mode === 'login' ? 'Sign In to Portal' : mode === 'signup' && selectedRole === 'clinic' ? 'Register Private Clinic' : 'Create Patient Profile'}
                    <ArrowRight className="ml-3 w-5 h-5" />
                  </span>
                )}
              </Button>
            </form>

            <div className="mt-10 pt-8 border-t border-white/5">
              <p className="text-center text-sm text-slate-400 font-medium">
                {mode === 'login' ? "New to the platform? " : "Already have an account? "}
                <button
                  type="button"
                  onClick={toggleMode}
                  className="ml-2 font-bold text-teal-400 hover:text-teal-300 transition-colors underline underline-offset-4 decoration-teal-400/30"
                >
                  {mode === 'login' ? 'Create Account' : 'Sign In Now'}
                </button>
              </p>
            </div>

            {mode === 'login' && (
              <div className="mt-8 p-6 bg-white/[0.03] rounded-2xl border border-white/5 backdrop-blur-sm">
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-4 opacity-70">Secure Demo Credentials</p>
                <div className="space-y-4">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-teal-400 uppercase tracking-tighter mb-1">Clinic Admin </span>
                    <p className="text-xs text-slate-400">User: <span className="font-mono text-white bg-white/10 px-1.5 py-0.5 rounded">clinic</span> • Pass: <span className="font-mono text-white bg-white/10 px-1.5 py-0.5 rounded">clinic123</span></p>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-teal-400 uppercase tracking-tighter mb-1">Patient</span>
                    <p className="text-xs text-slate-400">User: <span className="font-mono text-white bg-white/10 px-1.5 py-0.5 rounded">patient1</span> • Pass: <span className="font-mono text-white bg-white/10 px-1.5 py-0.5 rounded">patient123</span></p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Global Footer */}
        <div className="text-center mt-12 text-[10px] font-bold text-slate-600 tracking-[0.2em] uppercase">
          <p>© 2026 ClinicQ Platform • Encrypted • Healthcare Standard</p>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:5000';
  const fetchFromApi = (path: string, init?: RequestInit) => fetch(`${API_BASE_URL}${path}`, init);

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<{ id?: string; username: string; role: string; fullName?: string; clinicName?: string; clinicId?: string; phone?: string } | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('clinicq_token');
    const userJson = localStorage.getItem('clinicq_user');

    if (!token || !userJson) {
      return;
    }

    try {
      const parsedUser = JSON.parse(userJson);
      setUser(parsedUser);
      setIsLoggedIn(true);
    } catch {
      localStorage.removeItem('clinicq_token');
      localStorage.removeItem('clinicq_user');
    }
  }, []);

  const handleLogin = async (username: string, password: string) => {
    try {
      const response = await fetchFromApi('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: username.trim().toLowerCase(), password }),
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      localStorage.setItem('clinicq_token', data.token);
      localStorage.setItem('clinicq_user', JSON.stringify(data.user));

      setUser(data.user);
      setIsLoggedIn(true);
      return true;
    } catch {
      return false;
    }
  };

  const handleSignUp = async (userData: {
    username: string;
    password: string;
    email: string;
    role: 'clinic' | 'patient';
    clinicName?: string;
    facilityType?: 'clinic' | 'hospital';
    address?: string;
    contactNumber?: string;
    operatingHours?: string;
    fullName?: string;
    phone?: string;
    dateOfBirth?: string;
  }) => {
    try {
      const response = await fetchFromApi('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...userData,
          username: userData.username.trim().toLowerCase(),
          email: userData.email.trim().toLowerCase(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, message: data.message || 'Signup failed' };
      }

      localStorage.setItem('clinicq_token', data.token);
      localStorage.setItem('clinicq_user', JSON.stringify(data.user));

      setUser(data.user);
      setIsLoggedIn(true);

      return { success: true, message: 'Account created successfully!' };
    } catch {
      return { success: false, message: 'Unable to connect to backend server' };
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUser(null);
    localStorage.removeItem('clinicq_token');
    localStorage.removeItem('clinicq_user');
  };

  return (
    <div className="min-h-screen bg-background">
      {!isLoggedIn ? (
        <Login onLogin={handleLogin} onSignUp={handleSignUp} />
      ) : user?.role === 'clinic' ? (
        <Dashboard user={user} onLogout={handleLogout} />
      ) : (
        <PatientDashboard user={user} onLogout={handleLogout} />
      )}
    </div>
  );
}