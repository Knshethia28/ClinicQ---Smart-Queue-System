import React, { useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Badge, Avatar, AvatarFallback, Switch, Label, Input, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui';
import { toast } from 'sonner';
import { 
  Users, 
  Clock, 
  LogOut, 
  Plus,
  Stethoscope,
  Bell,
  Settings,
  Home,
  Moon,
  Sun,
  Activity,
  CheckCircle2,
  UserPlus,
  Trash2,
  Menu,
  X
} from 'lucide-react';

interface User {
  id?: string;
  username: string;
  role: string;
  clinicName?: string;
  clinicId?: string;
}

interface Doctor {
  id: string;
  name: string;
  specialization: string;
  slotDuration: number;
  activeQueueCount: number;
  availabilityStart?: string;
  availabilityEnd?: string;
  lunchStart?: string;
  lunchEnd?: string;
  workingDays?: string[];
  slotCapacity?: number;
  availability?: string;
}

interface Patient {
  id: string;
  name: string;
  token: string;
  queuePosition: number;
  estimatedWait: number;
  queueTier: number;
  status: 'waiting' | 'current' | 'completed';
  checkedIn: string;
  phone: string;
  doctorId: string;
  isEmergency: boolean;
}

interface DoctorQueueStats {
  waiting: number;
  active: number;
  completedToday: number;
  totalToday: number;
}

interface PendingReorder {
  doctorId: string;
  appointmentId: string;
  patientName: string;
  fromPosition: number;
  targetPosition: number;
}

interface DashboardProps {
  user: User | null;
  onLogout: () => void;
}

export function Dashboard({ user, onLogout }: DashboardProps) {
  const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:5000';
  const normalizeWorkingDays = (days: string[] | undefined) => {
    const map: Record<string, string> = {
      sun: 'Sun',
      sunday: 'Sun',
      mon: 'Mon',
      monday: 'Mon',
      tue: 'Tue',
      tues: 'Tue',
      tuesday: 'Tue',
      wed: 'Wed',
      wednesday: 'Wed',
      thu: 'Thu',
      thur: 'Thu',
      thurs: 'Thu',
      thursday: 'Thu',
      fri: 'Fri',
      friday: 'Fri',
      sat: 'Sat',
      saturday: 'Sat',
    };

    const normalized = Array.from(
      new Set((days || []).map((day) => map[String(day || '').trim().toLowerCase()]).filter(Boolean))
    );

    return normalized.length > 0 ? normalized : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  };
  const [activeTab, setActiveTab] = useState<'home' | 'doctors' | 'patients' | 'settings'>('home');
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoadingDoctors, setIsLoadingDoctors] = useState(false);
  const [isLoadingQueue, setIsLoadingQueue] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const [currentTime, setCurrentTime] = useState(new Date());
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('clinicq_theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [showAddDoctorDialog, setShowAddDoctorDialog] = useState(false);
  const [showWalkInDialog, setShowWalkInDialog] = useState(false);
  const [showAvailabilityDialog, setShowAvailabilityDialog] = useState(false);
  const [availabilityDoctorId, setAvailabilityDoctorId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [doctorStatsById, setDoctorStatsById] = useState<Record<string, DoctorQueueStats>>({});
  const [draggingPatientId, setDraggingPatientId] = useState<string | null>(null);
  const [dropTargetPatientId, setDropTargetPatientId] = useState<string | null>(null);
  const [pendingReorder, setPendingReorder] = useState<PendingReorder | null>(null);
  const [showReorderConfirmDialog, setShowReorderConfirmDialog] = useState(false);
  
  // Form states
  const [newDoctor, setNewDoctor] = useState({ name: '', specialization: '', slotDuration: '10' });
  const [walkInName, setWalkInName] = useState('');
  const [walkInPhone, setWalkInPhone] = useState('');
  const [walkInDoctorId, setWalkInDoctorId] = useState('');
  const [walkInType, setWalkInType] = useState<'normal' | 'emergency'>('normal');
  const [availabilityForm, setAvailabilityForm] = useState({
    availabilityStart: '09:00',
    availabilityEnd: '17:00',
    lunchStart: '13:00',
    lunchEnd: '14:00',
    slotDuration: '10',
    slotCapacity: '1',
    workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as string[],
  });

  const getAuthHeaders = () => {
    const token = localStorage.getItem('clinicq_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const syncDoctorQueueCounts = async (doctorList: Doctor[]) => {
    const nextDoctors = [...doctorList];

    await Promise.all(
      nextDoctors.map(async (doctor) => {
        try {
          const response = await fetch(`${API_BASE_URL}/api/queue/${doctor.id}`, {
            headers: getAuthHeaders(),
          });

          if (!response.ok) {
            doctor.activeQueueCount = 0;
            return;
          }

          const data = await response.json();
          doctor.activeQueueCount = data.total || 0;
        } catch {
          doctor.activeQueueCount = 0;
        }
      })
    );

    return nextDoctors;
  };

  const fetchDoctors = async () => {
    if (!user?.clinicId) {
      setDoctors([]);
      return;
    }

    setIsLoadingDoctors(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/doctors?clinicId=${user.clinicId}`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        setDoctors([]);
        return;
      }

      const data = await response.json();
      const mapped: Doctor[] = (data.doctors || []).map((doctor: any) => ({
        id: doctor._id,
        name: doctor.name,
        specialization: doctor.specialization,
        slotDuration: doctor.slotDuration || 10,
        activeQueueCount: 0,
        availabilityStart: doctor.availabilityStart || '09:00',
        availabilityEnd: doctor.availabilityEnd || '17:00',
        lunchStart: doctor.lunchStart || '13:00',
        lunchEnd: doctor.lunchEnd || '14:00',
        workingDays: normalizeWorkingDays(Array.isArray(doctor.workingDays) ? doctor.workingDays : undefined),
        slotCapacity: doctor.slotCapacity || 1,
        availability: `${doctor.availabilityStart || '09:00'}-${doctor.availabilityEnd || '17:00'}${doctor.lunchStart && doctor.lunchEnd ? ` (Lunch ${doctor.lunchStart}-${doctor.lunchEnd})` : ''}`,
      }));

      const withCounts = await syncDoctorQueueCounts(mapped);
      setDoctors(withCounts);

      if (!selectedDoctorId && withCounts.length > 0) {
        setSelectedDoctorId(withCounts[0].id);
      }
    } catch {
      setDoctors([]);
    } finally {
      setIsLoadingDoctors(false);
    }
  };

  const fetchQueue = async (doctorId: string) => {
    setIsLoadingQueue(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/queue/${doctorId}`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        setPatients([]);
        return;
      }

      const data = await response.json();
      const mappedPatients: Patient[] = (data.queue || []).map((item: any) => ({
        id: item._id,
        name: item.patientName,
        token: item.tokenNumber,
        queuePosition: Number(item.queuePosition) || 0,
        estimatedWait: Math.max(0, (Number(item.queuePosition) - 1) * 10),
        queueTier: Number(item.queueTier ?? 3),
        status: item.status === 'active' ? 'current' : 'waiting',
        checkedIn: new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        phone: item.phone,
        doctorId: item.doctorId,
        isEmergency: Boolean(item.isEmergency),
      }));

      setPatients(mappedPatients);
      setDoctors((prev) => prev.map((doctor) => (
        doctor.id === doctorId ? { ...doctor, activeQueueCount: mappedPatients.length } : doctor
      )));

      if (data.stats) {
        setDoctorStatsById((prev) => ({
          ...prev,
          [doctorId]: {
            waiting: Number(data.stats.waiting) || 0,
            active: Number(data.stats.active) || 0,
            completedToday: Number(data.stats.completedToday) || 0,
            totalToday: Number(data.stats.totalToday) || 0,
          },
        }));
      }
    } catch {
      setPatients([]);
    } finally {
      setIsLoadingQueue(false);
    }
  };

  // Background Sync: 15s intervals
  useEffect(() => {
    const syncAll = async () => {
      await fetchDoctors();
      if (selectedDoctorId) {
        await fetchQueue(selectedDoctorId);
      }
    };

    const pollTimer = setInterval(syncAll, 15000);
    return () => clearInterval(pollTimer);
  }, [selectedDoctorId]);

  // Background Sync: 15s intervals
  useEffect(() => {
    const syncAll = async () => {
      await fetchDoctors();
      if (selectedDoctorId) {
        await fetchQueue(selectedDoctorId);
      }
    };

    const pollTimer = setInterval(syncAll, 15000);
    return () => clearInterval(pollTimer);
  }, [selectedDoctorId]);

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Apply dark mode
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('clinicq_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('clinicq_theme', 'light');
    }
  }, [isDarkMode]);

  const sidebarItems = [
    { id: 'home', label: 'Admin Home', icon: Home },
    { id: 'doctors', label: 'Doctor Management', icon: Stethoscope },
    { id: 'patients', label: 'Queue Central', icon: Users },
    { id: 'settings', label: 'Clinic Profile', icon: Settings },
  ];

  useEffect(() => {
    fetchDoctors();
  }, [user?.clinicId]);

  useEffect(() => {
    if (!selectedDoctorId) {
      return;
    }

    fetchQueue(selectedDoctorId);
  }, [selectedDoctorId]);

  useEffect(() => {
    if (!selectedDoctorId) {
      return;
    }

    const socket = io(API_BASE_URL, { transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('joinDoctorRoom', selectedDoctorId);
    });

    socket.on('queueUpdated', (queue: any[]) => {
      const mappedPatients: Patient[] = (queue || []).map((item: any) => ({
        id: item._id,
        name: item.patientName,
        token: item.tokenNumber,
        queuePosition: Number(item.queuePosition) || 0,
        estimatedWait: Math.max(0, (Number(item.queuePosition) - 1) * 10),
        queueTier: Number(item.queueTier ?? 3),
        status: item.status === 'active' ? 'current' : 'waiting',
        checkedIn: new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        phone: item.phone,
        doctorId: item.doctorId,
        isEmergency: Boolean(item.isEmergency),
      }));

      setPatients(mappedPatients);
      setDoctors((prev) => prev.map((doctor) => (
        doctor.id === selectedDoctorId ? { ...doctor, activeQueueCount: mappedPatients.length } : doctor
      )));
      setDoctorStatsById((prev) => ({
        ...prev,
        [selectedDoctorId]: {
          waiting: mappedPatients.filter((patient) => patient.status === 'waiting').length,
          active: mappedPatients.some((patient) => patient.status === 'current') ? 1 : 0,
          completedToday: prev[selectedDoctorId]?.completedToday || 0,
          totalToday: prev[selectedDoctorId]?.totalToday || mappedPatients.length,
        },
      }));
    });

    return () => {
      socket.emit('leaveDoctorRoom', selectedDoctorId);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [API_BASE_URL, selectedDoctorId]);

  const handleAddDoctor = async () => {
    if (!newDoctor.name.trim() || !newDoctor.specialization.trim() || !user?.clinicId) {
      toast.error('Please fill in all doctor details');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/doctors`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          clinicId: user.clinicId,
          name: newDoctor.name,
          specialization: newDoctor.specialization,
          slotDuration: Number(newDoctor.slotDuration) || 10,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.message || 'Failed to add doctor');
        return;
      }

      toast.success(`${data.name} added successfully`);
      setNewDoctor({ name: '', specialization: '', slotDuration: '10' });
      setShowAddDoctorDialog(false);
      await fetchDoctors();
    } catch {
      toast.error('Unable to add doctor right now');
    }
  };

  const handleRemoveDoctor = async (doctorId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/doctors/${doctorId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.message || 'Failed to remove doctor');
        return;
      }

      toast.success('Doctor removed successfully');
      if (selectedDoctorId === doctorId) {
        setSelectedDoctorId(null);
      }
      await fetchDoctors();
    } catch {
      toast.error('Unable to remove doctor right now');
    }
  };

  const openAvailabilityDialog = (doctor: Doctor) => {
    setAvailabilityDoctorId(doctor.id);
    setAvailabilityForm({
      availabilityStart: doctor.availabilityStart || '09:00',
      availabilityEnd: doctor.availabilityEnd || '17:00',
      lunchStart: doctor.lunchStart || '13:00',
      lunchEnd: doctor.lunchEnd || '14:00',
      slotDuration: String(doctor.slotDuration || 10),
      slotCapacity: String(doctor.slotCapacity || 1),
      workingDays: normalizeWorkingDays(doctor.workingDays),
    });
    setShowAvailabilityDialog(true);
  };

  const toggleWorkingDay = (day: string) => {
    setAvailabilityForm((prev) => {
      const exists = prev.workingDays.includes(day);
      const nextDays = exists
        ? prev.workingDays.filter((item) => item !== day)
        : [...prev.workingDays, day];
      return {
        ...prev,
        workingDays: nextDays,
      };
    });
  };

  const handleSaveAvailability = async () => {
    if (!availabilityDoctorId) {
      return;
    }

    if (availabilityForm.workingDays.length === 0) {
      toast.error('Select at least one working day');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/doctors/${availabilityDoctorId}/availability`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          availabilityStart: availabilityForm.availabilityStart,
          availabilityEnd: availabilityForm.availabilityEnd,
          lunchStart: availabilityForm.lunchStart,
          lunchEnd: availabilityForm.lunchEnd,
          slotDuration: Number(availabilityForm.slotDuration) || 10,
          slotCapacity: Number(availabilityForm.slotCapacity) || 1,
          workingDays: availabilityForm.workingDays,
          daysToGenerate: 14,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.message || 'Failed to update availability');
        return;
      }

      toast.success('Availability updated', {
        description: `${data.generatedSlots || 0} slots generated for upcoming days.`,
      });
      setShowAvailabilityDialog(false);
      await fetchDoctors();
    } catch {
      toast.error('Unable to update availability right now');
    }
  };

  const handleAddWalkIn = async () => {
    if (!walkInName.trim() || !walkInDoctorId) {
      toast.error('Please enter patient name and select a doctor');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/appointments/walkin`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          patientName: walkInName,
          phone: walkInPhone || '+10000000000',
          doctorId: walkInDoctorId,
          isEmergency: walkInType === 'emergency',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.message || 'Failed to add walk-in patient');
        return;
      }

      toast.success('Walk-in patient added', {
        description: walkInType === 'emergency'
          ? `${walkInName} moved directly to consultation as emergency.`
          : `${walkInName} added to the end of the queue.`
      });

      setWalkInName('');
      setWalkInPhone('');
      setWalkInDoctorId('');
      setWalkInType('normal');
      setShowWalkInDialog(false);

      if (selectedDoctorId === walkInDoctorId) {
        await fetchQueue(walkInDoctorId);
      }
      await fetchDoctors();
    } catch {
      toast.error('Unable to add walk-in patient');
    }
  };

  const handleReorderPatient = async (doctorId: string, appointmentId: string, targetPosition: number) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/queue/${doctorId}/reorder`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ appointmentId, targetPosition }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.message || 'Failed to reorder patient');
        return;
      }

      toast.success('Queue position updated');
      await fetchQueue(doctorId);
      await fetchDoctors();
    } catch {
      toast.error('Unable to reorder patient right now');
    }
  };

  const handleDragStart = (patientId: string) => {
    setDraggingPatientId(patientId);
    setDropTargetPatientId(null);
  };

  const handleDragOver = (e: React.DragEvent, patientId: string) => {
    e.preventDefault();
    if (!draggingPatientId || draggingPatientId === patientId) {
      return;
    }
    setDropTargetPatientId(patientId);
  };

  const handleDropOnPatient = (doctorId: string, targetPatient: Patient, waitingPatientsList: Patient[]) => {
    if (!draggingPatientId || draggingPatientId === targetPatient.id) {
      return;
    }

    const draggedPatient = waitingPatientsList.find((patient) => patient.id === draggingPatientId);
    if (!draggedPatient) {
      return;
    }

    setPendingReorder({
      doctorId,
      appointmentId: draggedPatient.id,
      patientName: draggedPatient.name,
      fromPosition: draggedPatient.queuePosition,
      targetPosition: targetPatient.queuePosition,
    });
    setShowReorderConfirmDialog(true);
    setDraggingPatientId(null);
    setDropTargetPatientId(null);
  };

  const handleConfirmReorder = async () => {
    if (!pendingReorder) {
      return;
    }

    await handleReorderPatient(
      pendingReorder.doctorId,
      pendingReorder.appointmentId,
      pendingReorder.targetPosition
    );

    setPendingReorder(null);
    setShowReorderConfirmDialog(false);
  };

  const handleCancelReorder = () => {
    setPendingReorder(null);
    setShowReorderConfirmDialog(false);
    setDraggingPatientId(null);
    setDropTargetPatientId(null);
  };

  const handleNextPatient = async (doctorId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/queue/${doctorId}/next`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.message || 'Failed to call next patient');
        return;
      }

      toast.success('Next patient called');
      await fetchQueue(doctorId);
      await fetchDoctors();
    } catch {
      toast.error('Unable to call next patient');
    }
  };

  const handleCompleteCurrentPatient = async (doctorId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/queue/${doctorId}/complete`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.message || 'Failed to complete current patient');
        return;
      }

      toast.success('Current patient marked as completed');
      await fetchQueue(doctorId);
      await fetchDoctors();
    } catch {
      toast.error('Unable to complete current patient');
    }
  };

  const handleCompleteAndCallNext = async (doctorId: string) => {
    try {
      const completeResponse = await fetch(`${API_BASE_URL}/api/queue/${doctorId}/complete`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });

      const completeData = await completeResponse.json();
      if (!completeResponse.ok) {
        toast.error(completeData.message || 'Failed to complete current patient');
        return;
      }

      const nextResponse = await fetch(`${API_BASE_URL}/api/queue/${doctorId}/next`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });

      const nextData = await nextResponse.json();
      if (!nextResponse.ok) {
        toast.success('Current patient marked as completed');
        toast.error(nextData.message || 'No queue-eligible patient available right now');
        await fetchQueue(doctorId);
        await fetchDoctors();
        return;
      }

      toast.success('Current patient completed and next patient called');
      await fetchQueue(doctorId);
      await fetchDoctors();
    } catch {
      toast.error('Unable to complete and call next patient');
    }
  };

  const getDoctorPatients = (doctorId: string) => patients.filter(p => p.doctorId === doctorId);
  const totalWaiting = Object.values(doctorStatsById).reduce((sum, stats) => sum + (stats.waiting || 0), 0);
  const totalCurrent = Object.values(doctorStatsById).reduce((sum, stats) => sum + (stats.active || 0), 0);
  const completedToday = Object.values(doctorStatsById).reduce((sum, stats) => sum + (stats.completedToday || 0), 0);
  const selectedDoctor = useMemo(() => doctors.find((doctor) => doctor.id === (selectedDoctorId || doctors[0]?.id)), [doctors, selectedDoctorId]);

  return (
    <div className="min-h-screen bg-background font-sans">
      <header className="fixed top-0 left-0 right-0 z-50 bg-card/90 backdrop-blur-xl border-b border-border px-8 md:px-12 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            >
              <Menu className="w-5 h-5" />
            </Button>
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-br from-teal-500 to-teal-700 rounded-xl shadow-lg shadow-teal-500/20">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold font-heading tracking-tight leading-none">ClinicQ</h1>
                <p className="text-[10px] text-teal-600 dark:text-teal-400 font-bold uppercase tracking-widest mt-0.5">Partner Dashboard</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="hidden md:flex items-center space-x-2">
              <span className="text-sm font-medium">{user?.clinicName}</span>
            </div>
            <div className="text-sm text-muted-foreground tabular-nums">
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
            <Button variant="outline" size="sm" onClick={onLogout} className="h-8">
              <LogOut className="w-4 h-4 mr-1.5" />
              Exit
            </Button>
          </div>
        </div>
      </header>

      <div className="flex pt-20 min-h-screen">
        {/* Sidebar Overlay for mobile */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden" 
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside className={`fixed lg:sticky top-20 left-0 bottom-0 w-64 h-[calc(100vh-5rem)] bg-card border-r border-border overflow-y-auto transition-transform duration-300 z-40 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
          <nav className="p-8 md:p-12">
            <div className="space-y-2">
              {sidebarItems.map((item) => (
                <Button
                  key={item.id}
                  variant={activeTab === item.id ? 'default' : 'ghost'}
                  className={`w-full justify-start min-h-[2.75rem] h-auto py-2.5 px-4 rounded-xl transition-all ${
                    activeTab === item.id 
                      ? 'bg-teal-600 hover:bg-teal-700 text-white' 
                      : 'hover:bg-muted'
                  }`}
                  onClick={() => { setActiveTab(item.id as any); setIsSidebarOpen(false); }}
                >
                  <div className="flex items-start min-w-0">
                    <item.icon className={`w-5 h-5 mr-3 mt-0.5 flex-shrink-0 ${activeTab === item.id ? 'text-white' : 'text-teal-600'}`} />
                    <span className="font-semibold text-left whitespace-normal leading-tight">{item.label}</span>
                  </div>
                </Button>
              ))}
            </div>
          </nav>
        </aside>

        <main className="flex-1 p-8 md:p-12 overflow-y-auto bg-slate-50 dark:bg-[#020617] transition-all">
          <div className="max-w-[1400px] mx-auto animate-fade-in space-y-12">
            {activeTab === 'home' && (
              <div className="space-y-8">
                {/* Welcome Banner */}
                <div className="relative overflow-hidden bg-gradient-to-br from-teal-600 via-teal-500 to-cyan-500 text-white p-12 rounded-[2.5rem] shadow-2xl shadow-teal-500/20">
                  <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full blur-3xl -mr-40 -mt-40 animate-pulse-slow"></div>
                  <div className="relative z-10">
                    <h2 className="text-4xl font-extrabold mb-3 font-heading tracking-tight leading-tight">Welcome back, {user?.username}!</h2>
                    <p className="text-teal-50 text-xl font-medium max-w-2xl opacity-90">Manage your clinic operations and monitor patient flow in real-time.</p>
                  </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <Card className="glass-card hover-lift border-0">
                    <CardContent className="p-8">
                       <div className="flex items-center justify-between">
                         <div>
                           <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1 opacity-70">Doctors</p>
                           <p className="text-4xl font-black font-heading mt-1">{doctors.length}</p>
                         </div>
                         <div className="p-4 bg-teal-100 dark:bg-teal-900/50 rounded-2xl">
                           <Stethoscope className="w-8 h-8 text-teal-600 dark:text-teal-300" />
                         </div>
                       </div>
                    </CardContent>
                  </Card>

                  <Card className="glass-card hover-lift border-0">
                    <CardContent className="p-8">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1 opacity-70">Waiting</p>
                          <p className="text-4xl font-black font-heading mt-1">{totalWaiting}</p>
                        </div>
                        <div className="p-4 bg-orange-100 dark:bg-orange-900/50 rounded-2xl">
                          <Clock className="w-8 h-8 text-orange-600 dark:text-orange-300" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="glass-card hover-lift border-0">
                    <CardContent className="p-8">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1 opacity-70">Current</p>
                          <p className="text-4xl font-black font-heading mt-1">{totalCurrent}</p>
                        </div>
                        <div className="p-4 bg-blue-100 dark:bg-blue-900/50 rounded-2xl">
                          <Users className="w-8 h-8 text-blue-600 dark:text-blue-300" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="glass-card hover-lift border-0">
                    <CardContent className="p-8">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1 opacity-70">Completed</p>
                          <p className="text-4xl font-black font-heading mt-1">{completedToday}</p>
                        </div>
                        <div className="p-4 bg-green-100 dark:bg-green-900/50 rounded-2xl">
                          <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-300" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                  <CardDescription>Manage your clinic efficiently</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Button
                      className="h-24 flex flex-col items-start justify-center bg-teal-50 dark:bg-teal-950 hover:bg-teal-100 dark:hover:bg-teal-900 text-teal-700 dark:text-teal-300 border-2 border-teal-200 dark:border-teal-800"
                      variant="outline"
                      onClick={() => setShowAddDoctorDialog(true)}
                    >
                      <UserPlus className="w-6 h-6 mb-2" />
                      <span className="font-semibold">Add Doctor</span>
                      <span className="text-xs text-muted-foreground">Register new doctor</span>
                    </Button>

                    <Button
                      className="h-24 flex flex-col items-start justify-center bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-700 dark:text-blue-300 border-2 border-blue-200 dark:border-blue-800"
                      variant="outline"
                      onClick={() => setActiveTab('doctors')}
                    >
                      <Stethoscope className="w-6 h-6 mb-2" />
                      <span className="font-semibold">Manage Doctors</span>
                      <span className="text-xs text-muted-foreground">{doctors.length} active doctors</span>
                    </Button>

                    <Button
                      className="h-24 flex flex-col items-start justify-center bg-green-50 dark:bg-green-950 hover:bg-green-100 dark:hover:bg-green-900 text-green-700 dark:text-green-300 border-2 border-green-200 dark:border-green-800"
                      variant="outline"
                      onClick={() => setShowWalkInDialog(true)}
                      disabled={doctors.length === 0}
                    >
                      <Plus className="w-6 h-6 mb-2" />
                      <span className="font-semibold">Add Walk-in</span>
                      <span className="text-xs text-muted-foreground">Register new patient</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Doctors Overview */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Doctors Overview</CardTitle>
                    <Button variant="outline" size="sm" onClick={() => setActiveTab('doctors')}>
                      View All
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {doctors.map((doctor) => {
                      const doctorCurrentPatient = patients.find(p => p.doctorId === doctor.id && p.status === 'current');
                      return (
                        <div key={doctor.id} className="flex items-center justify-between p-5 border-2 border-border rounded-xl hover:border-teal-200 dark:hover:border-teal-800 hover:shadow-md transition-all bg-muted/30">
                          <div className="flex items-center space-x-4">
                            <div className="w-14 h-14 bg-gradient-to-br from-teal-100 to-teal-200 dark:from-teal-900 dark:to-teal-800 rounded-xl flex items-center justify-center shadow-sm">
                              <Stethoscope className="w-7 h-7 text-teal-600 dark:text-teal-300" />
                            </div>
                            <div>
                              <h4 className="font-semibold text-base">{doctor.name}</h4>
                              <p className="text-sm text-muted-foreground">{doctor.specialization}</p>
                              <p className="text-xs text-muted-foreground mt-1.5 flex items-center">
                                <Clock className="w-3.5 h-3.5 inline mr-1.5" />
                                {doctor.slotDuration} min slot duration
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-4">
                            <div className="text-right">
                              <p className="text-xs text-muted-foreground uppercase tracking-wide">Active Queue</p>
                              <p className="text-2xl font-bold">{doctor.activeQueueCount}</p>
                            </div>
                            
                          </div>
                        </div>
                      );
                    })}
                    {!isLoadingDoctors && doctors.length === 0 && (
                      <p className="text-sm text-muted-foreground">No doctors found. Add your first doctor.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'doctors' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Manage Doctors</h2>
                  <p className="text-sm text-muted-foreground">Add, edit, and manage doctors in your clinic</p>
                </div>
                <Button onClick={() => setShowAddDoctorDialog(true)} className="bg-teal-600 hover:bg-teal-700">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add Doctor
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {doctors.map((doctor) => (
                  <Card key={doctor.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-12 h-12 bg-teal-100 dark:bg-teal-900 rounded-full flex items-center justify-center">
                            <Stethoscope className="w-6 h-6 text-teal-600 dark:text-teal-300" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{doctor.name}</CardTitle>
                            <CardDescription>{doctor.specialization}</CardDescription>
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleRemoveDoctor(doctor.id)}
                          className="hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Clock className="w-4 h-4 mr-2" />
                          {doctor.availability}
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-border">
                          <span className="text-sm text-muted-foreground">Active Queue</span>
                          <Badge variant={doctor.activeQueueCount > 0 ? 'default' : 'secondary'}>
                            {doctor.activeQueueCount} patients
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <Button 
                            className="w-full" 
                            variant="outline"
                            onClick={() => {
                              setSelectedDoctorId(doctor.id);
                              setActiveTab('patients');
                            }}
                          >
                            View Queue
                          </Button>
                              <Button className="w-full" variant="secondary" onClick={() => openAvailabilityDialog(doctor)}>
                                Availability via Slots
                              </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {!isLoadingDoctors && doctors.length === 0 && (
                  <Card>
                    <CardContent className="py-10 text-center text-muted-foreground">No doctors configured for this clinic yet.</CardContent>
                  </Card>
                )}
              </div>
            </div>
          )}

          {activeTab === 'patients' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold">Patient Queues</h2>
                <p className="text-sm text-muted-foreground">Manage queues for each doctor</p>
              </div>

              {/* Doctor selector */}
              <div className="flex flex-wrap items-center gap-2 p-2 bg-muted/50 rounded-xl border border-border">
                <span className="text-sm font-medium text-muted-foreground ml-2 mr-1">Select Doctor:</span>
                <div className="flex items-center gap-2 flex-wrap flex-1">
                  {doctors.map(doctor => {
                    const isActive = (selectedDoctorId || doctors[0]?.id) === doctor.id;
                    return (
                      <Button
                        key={doctor.id}
                        variant={isActive ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedDoctorId(doctor.id)}
                        className={`rounded-full px-4 transition-all ${
                          isActive 
                            ? 'bg-teal-600 hover:bg-teal-700 text-white shadow-sm border-transparent' 
                            : 'bg-background hover:bg-muted text-muted-foreground border-border'
                        }`}
                      >
                        <Stethoscope className="w-3.5 h-3.5 mr-2" />
                        {doctor.name}
                      </Button>
                    );
                  })}
                </div>
              </div>

              {[selectedDoctor].filter((d): d is Doctor => d !== undefined).map(doctor => {
                const doctorPatients = getDoctorPatients(doctor.id);
                const currentPatient = doctorPatients.find(p => p.status === 'current');
                const waitingPatientsList = doctorPatients.filter(p => p.status === 'waiting');
                const queueEligibleWaitingPatients = waitingPatientsList.filter((patient) => patient.queueTier !== 2);
                const selectedStats = doctorStatsById[doctor.id] || { waiting: waitingPatientsList.length, active: currentPatient ? 1 : 0, completedToday: 0, totalToday: doctorPatients.length };
                const minWaitingPosition = currentPatient ? 2 : 1;

                return (
                  <div key={doctor.id} className="space-y-4 mb-8">
                    <div className="flex items-center justify-between pb-2 border-b border-border">
                      <h3 className="text-xl font-bold">{doctor.name}</h3>
                      <span className="text-sm text-muted-foreground">{doctor.specialization}</span>
                    </div>

                    {/* Stats Row */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <Card className="shadow-sm">
                        <CardContent className="p-4 flex items-center space-x-4">
                          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-500 rounded-xl">
                            <Clock className="w-6 h-6" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Waiting</p>
                            <p className="text-2xl font-bold">{selectedStats.waiting}</p>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="shadow-sm">
                        <CardContent className="p-4 flex items-center space-x-4">
                          <div className="p-3 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-500 rounded-xl">
                            <Activity className="w-6 h-6" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">In Consultation</p>
                            <p className="text-2xl font-bold">{selectedStats.active}</p>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="shadow-sm">
                        <CardContent className="p-4 flex items-center space-x-4">
                          <div className="p-3 bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-500 rounded-xl">
                            <CheckCircle2 className="w-6 h-6" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Completed</p>
                            <p className="text-2xl font-bold">{selectedStats.completedToday}</p>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="shadow-sm">
                        <CardContent className="p-4 flex items-center space-x-4">
                          <div className="p-3 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-500 rounded-xl">
                            <Activity className="w-6 h-6" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Total Today</p>
                            <p className="text-2xl font-bold">{selectedStats.totalToday}</p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Main Layout */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
                      {/* Left: In Consultation */}
                      <Card className="border-green-200 dark:border-green-800 shadow-sm overflow-hidden">
                        <div className="bg-green-50 dark:bg-green-900/20 px-4 py-3 flex items-center space-x-2 border-b border-green-100 dark:border-green-800/50">
                          <Activity className="w-4 h-4 text-green-700 dark:text-green-500" />
                          <span className="font-semibold text-green-800 dark:text-green-400">In Consultation</span>
                        </div>
                        <CardContent className="p-6 flex flex-col items-center justify-center min-h-[200px]">
                          {currentPatient ? (
                            <div className="w-full text-center space-y-4">
                              <Avatar className="w-16 h-16 mx-auto">
                                <AvatarFallback className="bg-green-100 text-green-700 text-xl">
                                  {currentPatient.name.split(' ').map(n => n.charAt(0)).join('')}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <h4 className="font-bold text-lg">{currentPatient.name}</h4>
                                <p className="text-sm text-muted-foreground">Token: {currentPatient.token}</p>
                              </div>
                              <Button
                                onClick={() => queueEligibleWaitingPatients.length > 0 ? handleCompleteAndCallNext(doctor.id) : handleCompleteCurrentPatient(doctor.id)}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white mt-4"
                              >
                                Complete & Call Next
                              </Button>
                            </div>
                          ) : (
                            <div className="text-center space-y-4">
                              <Activity className="w-12 h-12 text-muted-foreground opacity-20 mx-auto" />
                              <p className="text-sm text-muted-foreground font-medium">No active consultation</p>
                              <Button
                                onClick={() => handleNextPatient(doctor.id)}
                                disabled={queueEligibleWaitingPatients.length === 0}
                                className="bg-blue-600 hover:bg-blue-700 text-white mt-2"
                              >
                                Call Next Patient
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* Right: Waiting Queue */}
                      <Card className="lg:col-span-2 shadow-sm min-h-[250px]">
                        <CardHeader className="pb-3 border-b border-border">
                          <CardTitle className="text-base">Waiting Queue ({waitingPatientsList.length})</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                          {isLoadingQueue ? (
                            <div className="flex flex-col items-center justify-center min-h-[200px] text-muted-foreground">
                              <p className="text-sm font-medium">Loading queue...</p>
                            </div>
                          ) : waitingPatientsList.length > 0 ? (
                            <div className="overflow-hidden">
                              {waitingPatientsList.map((patient, index) => (
                                <div
                                  key={patient.id}
                                  draggable
                                  onDragStart={() => handleDragStart(patient.id)}
                                  onDragOver={(e) => handleDragOver(e, patient.id)}
                                  onDrop={() => handleDropOnPatient(doctor.id, patient, waitingPatientsList)}
                                  onDragEnd={() => {
                                    setDraggingPatientId(null);
                                    setDropTargetPatientId(null);
                                  }}
                                  className={`flex items-center justify-between p-4 bg-background hover:bg-muted/50 border-b border-border last:border-b-0 cursor-move transition-colors ${
                                    draggingPatientId === patient.id ? 'opacity-60' : ''
                                  } ${dropTargetPatientId === patient.id ? 'bg-teal-50 dark:bg-teal-950/30' : ''}`}
                                >
                                  <div className="flex items-center space-x-4">
                                    <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center text-sm font-medium">
                                      {patient.queuePosition}
                                    </div>
                                    <Avatar className="w-10 h-10">
                                      <AvatarFallback className="bg-muted">
                                        {patient.name.split(' ').map(n => n.charAt(0)).join('')}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div>
                                      <h4 className="font-medium">{patient.name}</h4>
                                      <p className="text-sm text-muted-foreground">Token: {patient.token} • {patient.checkedIn}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center space-x-4">
                                    <Badge variant="outline" className="text-orange-700 border-orange-200 dark:text-orange-400 dark:border-orange-800">
                                      ~{patient.estimatedWait}m wait
                                    </Badge>
                                    <Badge variant={patient.isEmergency ? 'destructive' : 'secondary'}>
                                      {patient.isEmergency ? 'Emergency' : 'Waiting'}
                                    </Badge>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center min-h-[200px] text-muted-foreground">
                              <p className="text-sm font-medium">Queue is empty</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                );
              })}
              {!selectedDoctor && !isLoadingDoctors && (
                <Card>
                  <CardContent className="py-10 text-center text-muted-foreground">Select a doctor to view queue.</CardContent>
                </Card>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold">Settings</h2>
                <p className="text-sm text-muted-foreground">Customize your clinic dashboard</p>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Appearance</CardTitle>
                  <CardDescription>Customize how your dashboard looks</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {isDarkMode ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                      <div>
                        <Label className="text-sm font-medium">Dark Mode</Label>
                        <p className="text-xs text-muted-foreground">Toggle dark mode theme</p>
                      </div>
                    </div>
                    <Switch
                      checked={isDarkMode}
                      onCheckedChange={setIsDarkMode}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Clinic Information</CardTitle>
                  <CardDescription>Your clinic details</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">Clinic Name</Label>
                    <p className="text-sm text-muted-foreground mt-1">{user?.clinicName || 'Not set'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Admin Username</Label>
                    <p className="text-sm text-muted-foreground mt-1">{user?.username}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Total Doctors</Label>
                    <p className="text-sm text-muted-foreground mt-1">{doctors.length} active doctors</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        

      {/* Add Doctor Dialog */}
      <Dialog open={showAddDoctorDialog} onOpenChange={setShowAddDoctorDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Doctor</DialogTitle>
            <DialogDescription>
              Register a new doctor to your clinic
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="doctorName">Doctor Name</Label>
              <Input
                id="doctorName"
                placeholder="Dr. John Smith"
                value={newDoctor.name}
                onChange={(e) => setNewDoctor({ ...newDoctor, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="specialization">Specialization</Label>
              <Input
                id="specialization"
                placeholder="General Practice, Cardiology, etc."
                value={newDoctor.specialization}
                onChange={(e) => setNewDoctor({ ...newDoctor, specialization: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="availability">Availability Time</Label>
              <Input
                id="availability"
                type="number"
                min="5"
                step="5"
                placeholder="10"
                value={newDoctor.slotDuration}
                onChange={(e) => setNewDoctor({ ...newDoctor, slotDuration: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDoctorDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddDoctor} className="bg-teal-600 hover:bg-teal-700">
              Add Doctor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showReorderConfirmDialog} onOpenChange={(open) => {
        if (!open) {
          handleCancelReorder();
        } else {
          setShowReorderConfirmDialog(true);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Queue Reorder</DialogTitle>
            <DialogDescription>
              {pendingReorder
                ? `${pendingReorder.patientName} will move from position ${pendingReorder.fromPosition} to ${pendingReorder.targetPosition}.`
                : 'Confirm updating patient queue position.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelReorder}>
              Cancel
            </Button>
            <Button onClick={handleConfirmReorder} className="bg-teal-600 hover:bg-teal-700">
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Walk-in Dialog */}
      <Dialog open={showWalkInDialog} onOpenChange={setShowWalkInDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Walk-in Patient</DialogTitle>
            <DialogDescription>
              Register a normal or emergency walk-in patient
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="walkInName">Patient Name</Label>
              <Input
                id="walkInName"
                placeholder="Enter patient name"
                value={walkInName}
                onChange={(e) => setWalkInName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="walkInPhone">Phone Number (Optional)</Label>
              <Input
                id="walkInPhone"
                placeholder="Enter phone number"
                value={walkInPhone}
                onChange={(e) => setWalkInPhone(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="walkInDoctor">Assign to Doctor</Label>
              <select 
                id="walkInDoctor"
                title="Select doctor"
                value={walkInDoctorId} 
                onChange={(e) => setWalkInDoctorId(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-md bg-background"
              >
                <option value="">Select a doctor</option>
                {doctors.map(doctor => (
                  <option key={doctor.id} value={doctor.id}>
                    {doctor.name} - {doctor.specialization}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Walk-in Type</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={walkInType === 'normal' ? 'default' : 'outline'}
                  className={walkInType === 'normal' ? 'bg-teal-600 hover:bg-teal-700 text-white' : ''}
                  onClick={() => setWalkInType('normal')}
                >
                  Normal
                </Button>
                <Button
                  type="button"
                  variant={walkInType === 'emergency' ? 'default' : 'outline'}
                  className={walkInType === 'emergency' ? 'bg-red-600 hover:bg-red-700 text-white' : ''}
                  onClick={() => setWalkInType('emergency')}
                >
                  Emergency
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Emergency moves directly to consultation. Normal is added to the end of queue.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWalkInDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddWalkIn} className="bg-teal-600 hover:bg-teal-700">
              Add Patient
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Set Availability Dialog */}
      <Dialog open={showAvailabilityDialog} onOpenChange={setShowAvailabilityDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Set Doctor Availability</DialogTitle>
            <DialogDescription>
              Configure working hours and slot durations.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Working Days</Label>
              <div className="flex flex-wrap gap-2">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                  <Badge
                    key={day}
                    variant={availabilityForm.workingDays.includes(day) ? "default" : "outline"}
                    className={availabilityForm.workingDays.includes(day) ? "bg-teal-600 cursor-pointer" : "cursor-pointer"}
                    onClick={() => toggleWorkingDay(day)}
                  >
                    {day}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startTime">Start Time</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={availabilityForm.availabilityStart}
                  onChange={(e) => setAvailabilityForm((prev) => ({ ...prev, availabilityStart: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime">End Time</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={availabilityForm.availabilityEnd}
                  onChange={(e) => setAvailabilityForm((prev) => ({ ...prev, availabilityEnd: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="lunchStart">Lunch Start</Label>
                <Input
                  id="lunchStart"
                  type="time"
                  value={availabilityForm.lunchStart}
                  onChange={(e) => setAvailabilityForm((prev) => ({ ...prev, lunchStart: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lunchEnd">Lunch End</Label>
                <Input
                  id="lunchEnd"
                  type="time"
                  value={availabilityForm.lunchEnd}
                  onChange={(e) => setAvailabilityForm((prev) => ({ ...prev, lunchEnd: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="slotDuration">Slot Duration</Label>
              <select 
                id="slotDuration"
                title="Select slot duration"
                className="w-full px-3 py-2 border border-border rounded-md bg-background"
                value={availabilityForm.slotDuration}
                onChange={(e) => setAvailabilityForm((prev) => ({ ...prev, slotDuration: e.target.value }))}
              >
                <option value="10">10 mins</option>
                <option value="15">15 mins</option>
                <option value="20">20 mins</option>
                <option value="30">30 mins</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="slotCapacity">Slot Capacity</Label>
              <Input
                id="slotCapacity"
                type="number"
                min="1"
                step="1"
                value={availabilityForm.slotCapacity}
                onChange={(e) => setAvailabilityForm((prev) => ({ ...prev, slotCapacity: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAvailabilityDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveAvailability} className="bg-teal-600 hover:bg-teal-700">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </div>
      </main>
    </div>
  </div>
  );
}