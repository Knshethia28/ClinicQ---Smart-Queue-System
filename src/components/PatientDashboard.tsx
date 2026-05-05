import React, { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Badge, Avatar, AvatarFallback, Alert, AlertDescription, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label, Switch } from '../ui';
import { toast } from 'sonner';
import {
  Activity,
  User,
  Calendar,
  Clock,
  CheckCircle,
  LogOut,
  Users,
  Stethoscope,
  Bell,
  Phone,
  MapPin,
  Heart,
  Search,
  Star,
  Car,
  Building,
  Home,
  Settings,
  Moon,
  Sun,
  ArrowRight,
  Menu,
  X,
  ChevronLeft
} from 'lucide-react';

interface User {
  id?: string;
  username: string;
  role: string;
  fullName?: string;
  phone?: string;
}

interface Appointment {
  id: string;
  doctorId: string;
  doctorName: string;
  clinicId: string;
  clinicName: string;
  date: string;
  time: string;
  slotId?: string;
  tokenNumber?: string;
  estimatedTravelMinutes?: number;
  status: 'booked' | 'active' | 'completed' | 'cancelled';
}

interface SlotOption {
  id: string;
  startTime: string;
  endTime: string;
  capacity: number;
  bookedCount: number;
}

interface QueueStatus {
  isInQueue: boolean;
  token?: string;
  position?: number;
  estimatedWait?: number;
  estimatedWaitMin?: number;
  estimatedWaitMax?: number;
  status: 'not-checked-in' | 'waiting' | 'current' | 'completed';
  checkedInTime?: string;
}

interface Doctor {
  id: string;
  name: string;
  specialization: string;
  availability: string;
  queueCount: number;
  avgWaitTime: number;
}

interface Clinic {
  id: string;
  name: string;
  address: string;
  distance: number;
  location?: { lat: number; lng: number };
  travelTime: number;
  rating: number;
  doctors: Doctor[];
  status: 'open' | 'busy' | 'closed';
  facilityType?: 'clinic' | 'hospital';
  phone: string;
  contactNumber: string;
  operatingHours: string;
  isRegistered?: boolean; // New field to distinguish partner vs public clinics
}

interface PatientDashboardProps {
  user: User | null;
  onLogout: () => void;
}

function ClinicCard({
  clinic,
  isFavorite,
  onToggleFavorite,
  onViewDetails
}: {
  clinic: Clinic;
  isFavorite: boolean;
  onToggleFavorite: (clinicId: string) => void;
  onViewDetails: (clinic: Clinic) => void;
}) {
  const totalWaiting = clinic.doctors.reduce((sum, d) => sum + d.queueCount, 0);
  const avgWaitTime = clinic.doctors.length > 0
    ? Math.round(clinic.doctors.reduce((sum, d) => sum + d.avgWaitTime, 0) / clinic.doctors.length)
    : 0;

  return (
    <Card className={`glass-card group animate-slide-up overflow-hidden hover-lift ${!clinic.isRegistered
        ? 'border-0 ring-1 ring-amber-300 dark:ring-amber-700/50'
        : `${clinic.status === 'closed' ? 'opacity-60' : 'border-0 hover:ring-2 hover:ring-teal-400 dark:hover:ring-teal-600'}`
      }`}>
      {/* "Not on ClinicQ" prominent top banner */}
      {!clinic.isRegistered && (
        <div className="flex items-center justify-center gap-2 px-4 py-2 bg-amber-100 dark:bg-amber-900/40 border-b border-amber-300 dark:border-amber-700">
          <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
          <span className="text-xs font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-widest">
            Not on ClinicQ
          </span>
          <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
        </div>
      )}

      <CardContent className="p-6">
        {/* Header Section */}
        <div className={`flex items-start justify-between ${!clinic.isRegistered ? 'mb-6' : 'mb-6'}`}>
          <div className="flex items-start space-x-4 flex-1">
            <div className={`w-20 h-20 rounded-2xl flex items-center justify-center shadow-2xl transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 ${clinic.isRegistered
                ? 'bg-gradient-to-br from-teal-400 to-teal-600 shadow-teal-500/20'
                : 'bg-gradient-to-br from-amber-400 to-amber-600 shadow-amber-500/20'
              }`}>
              <Building className="w-10 h-10 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-2xl font-bold mb-1 font-heading tracking-tight group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">{clinic.name}</h3>
                  <p className="text-sm text-muted-foreground flex items-center mt-2 font-medium">
                    <MapPin className="w-4 h-4 mr-2 text-teal-500" />
                    {clinic.address}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onToggleFavorite(clinic.id)}
                  className="p-2 h-9 w-9 hover:bg-red-50 dark:hover:bg-red-950"
                >
                  <Heart
                    className={`w-5 h-5 ${isFavorite
                        ? 'text-red-500 fill-current'
                        : 'text-gray-400 hover:text-red-500'
                      }`}
                  />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid — 3 cols for public, 4 cols for registered */}
        <div className={`grid gap-3 mb-5 ${clinic.isRegistered ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-1 sm:grid-cols-3'}`}>
          <div className="flex flex-col items-center p-3 bg-muted/50 rounded-lg">
            <Car className="w-5 h-5 text-muted-foreground mb-1.5" />
            <p className="text-xs text-muted-foreground mb-0.5">Distance</p>
            <p className="text-base font-bold">{clinic.distance.toFixed(1)} km</p>
          </div>
          <div className="flex flex-col items-center p-3 bg-muted/50 rounded-lg">
            <Clock className="w-5 h-5 text-muted-foreground mb-1.5" />
            <p className="text-xs text-muted-foreground mb-0.5">Travel</p>
            <p className="text-base font-bold">{clinic.travelTime} min</p>
          </div>
          <div className="flex flex-col items-center p-3 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg">
            <Star className="w-5 h-5 text-yellow-500 fill-current mb-1.5" />
            <p className="text-xs text-muted-foreground mb-0.5">Rating</p>
            <p className="text-base font-bold">{clinic.rating > 0 ? clinic.rating.toFixed(1) : 'N/A'}</p>
          </div>
          {/* Queue stat — registered clinics only */}
          {clinic.isRegistered && (
            <div className="flex flex-col items-center p-3 bg-teal-50 dark:bg-teal-950/30 rounded-lg">
              <Users className="w-5 h-5 text-teal-600 dark:text-teal-400 mb-1.5" />
              <p className="text-xs text-muted-foreground mb-0.5">Queue</p>
              <p className="text-base font-bold">{totalWaiting}</p>
            </div>
          )}
        </div>

        {/* Doctors Preview — registered clinics only */}
        {clinic.isRegistered && (
          <div className="mb-5">
            <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
              {clinic.doctors.length} Available Doctors
            </p>
            <div className="flex overflow-x-auto space-x-2 pb-2 scrollbar-hide">
              {clinic.doctors.slice(0, 3).map((doctor) => (
                <div key={doctor.id} className="flex-shrink-0 p-3 bg-background border border-border rounded-lg min-w-[160px] hover:border-teal-300 dark:hover:border-teal-700 transition-colors">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="w-8 h-8 bg-teal-100 dark:bg-teal-900/50 rounded-full flex items-center justify-center">
                      <Stethoscope className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                    </div>
                    <p className="text-xs font-medium truncate">{doctor.name.replace('Dr. ', '')}</p>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mb-1">{doctor.specialization}</p>
                  <p className="text-xs text-muted-foreground">{doctor.queueCount} in queue</p>
                </div>
              ))}
              {clinic.doctors.length > 3 && (
                <div className="flex-shrink-0 p-3 bg-muted/30 border border-dashed border-border rounded-lg min-w-[100px] flex items-center justify-center">
                  <p className="text-xs text-muted-foreground font-medium">+{clinic.doctors.length - 3} more</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Wait Time Bar — registered clinics only */}
        {clinic.isRegistered && (
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-950/30 dark:to-cyan-950/30 rounded-lg mb-4 border border-teal-100 dark:border-teal-900">
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              <span className="text-sm font-medium text-teal-900 dark:text-teal-100">Est. Wait Time:</span>
            </div>
            <span className="text-lg font-bold text-teal-700 dark:text-teal-300">{avgWaitTime} min</span>
          </div>
        )}

        {/* Spacer for public clinics so actions sit cleanly */}
        {!clinic.isRegistered && <div className="mb-4" />}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 space-x-0">
          <Badge
            className={`text-xs px-3 py-1 self-start sm:self-auto ${clinic.status === 'open'
                ? 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-200 dark:border-green-800'
                : clinic.status === 'busy'
                  ? 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900 dark:text-yellow-200 dark:border-yellow-800'
                  : 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-200 dark:border-red-800'
              }`}
            variant="outline"
          >
            {clinic.status === 'open' ? '● Open Now' : clinic.status === 'busy' ? '● Busy' : '● Closed'}
          </Badge>
          {clinic.isRegistered ? (
            <Button
              size="lg"
              disabled={clinic.status === 'closed'}
              className="w-full sm:flex-1 bg-teal-600 hover:bg-teal-700 text-white font-semibold h-11 shadow-md hover:shadow-lg transition-all disabled:opacity-50"
              onClick={() => onViewDetails(clinic)}
            >
              View Doctors & Book
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button
              size="lg"
              variant="outline"
              className="w-full sm:flex-1 border-amber-400 text-amber-800 dark:text-amber-300 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/30 font-semibold h-11 transition-all"
              onClick={() => onViewDetails(clinic)}
            >
              View Clinic Info
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function PatientDashboard({ user, onLogout }: PatientDashboardProps) {
  const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:5000';
  const MAX_LOCATION_ACCURACY_METERS = 3000;
  const fetchFromApi = (path: string, init?: RequestInit) => fetch(`${API_BASE_URL}${path}`, init);
  const getLocalYmd = (date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [activeTab, setActiveTab] = useState<'home' | 'clinics' | 'appointments' | 'queue' | 'settings'>('home');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('clinicq_theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [queueStatus, setQueueStatus] = useState<QueueStatus>({
    isInQueue: false,
    status: 'not-checked-in'
  });

  const [appointments, setAppointments] = useState<Appointment[]>([]);

  const [selectedClinic, setSelectedClinic] = useState<Clinic | null>(null);
  const [selectedDoctorForBooking, setSelectedDoctorForBooking] = useState<Doctor | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(getLocalYmd());
  const [availableSlots, setAvailableSlots] = useState<SlotOption[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);

  const [showClinicDetails, setShowClinicDetails] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [favoriteClinicIds, setFavoriteClinicIds] = useState<string[]>([]);
  const [locationPermission, setLocationPermission] = useState<'idle' | 'requesting' | 'granted' | 'denied' | 'error'>('idle');
  const [locationError, setLocationError] = useState('');
  const [locationAccuracyMeters, setLocationAccuracyMeters] = useState<number | null>(null);
  const [isLoadingClinics, setIsLoadingClinics] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [discoveryMode, setDiscoveryMode] = useState<'clinics' | 'hospitals'>('clinics');
  const [modeClinicsCache, setModeClinicsCache] = useState<Record<'clinics' | 'hospitals', Clinic[]>>({
    clinics: [],
    hospitals: [],
  });
  const [modeCacheLocationKey, setModeCacheLocationKey] = useState<string | null>(null);
  const [activeQueueDoctorId, setActiveQueueDoctorId] = useState<string | null>(null);
  const [activeQueueAppointmentId, setActiveQueueAppointmentId] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const patientDisplayName = user?.fullName?.trim() || user?.username?.trim() || 'Patient';
  const patientPhone = user?.phone?.trim() || '';

  const [nearbyClinics, setNearbyClinics] = useState<Clinic[]>([]);

  const getAppointmentTimestamp = (appointment: Appointment) => {
    const datePart = /^\d{4}-\d{2}-\d{2}$/.test(appointment.date || '') ? appointment.date : getLocalYmd();
    const startLabel = String(appointment.time || '').split('-')[0]?.trim() || '';
    const timeMatch = startLabel.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);

    const dateTime = new Date(`${datePart}T00:00:00`);
    if (!timeMatch) {
      return dateTime.getTime();
    }

    let hour = Number(timeMatch[1]);
    const minute = Number(timeMatch[2]);
    const meridian = timeMatch[3].toUpperCase();

    if (meridian === 'PM' && hour !== 12) {
      hour += 12;
    }
    if (meridian === 'AM' && hour === 12) {
      hour = 0;
    }

    dateTime.setHours(hour, minute, 0, 0);
    return dateTime.getTime();
  };

  const getQueueTriggerTimestamp = (appointment: Appointment) => {
    const startAt = getAppointmentTimestamp(appointment);
    const leadMinutes = 15 + Math.max(0, Number(appointment.estimatedTravelMinutes || 15));
    return startAt - leadMinutes * 60 * 1000;
  };

  const isAutoQueueWindowOpen = (appointment: Appointment) => Date.now() >= getQueueTriggerTimestamp(appointment);

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

  const fetchNearbyClinics = async (
    lat: number,
    lng: number,
    options?: { mode?: 'clinics' | 'hospitals'; forceRefresh?: boolean; backgroundRefresh?: boolean }
  ) => {
    const mode = options?.mode || discoveryMode;
    const locationKey = `${lat.toFixed(4)}:${lng.toFixed(4)}`;

    if (!options?.forceRefresh && modeCacheLocationKey === locationKey && modeClinicsCache[mode].length > 0) {
      setNearbyClinics(modeClinicsCache[mode]);
      setLocationError('');
      return;
    }

    const shouldShowLoading = !options?.backgroundRefresh;
    if (shouldShowLoading) {
      setIsLoadingClinics(true);
    }
    const liveFetchStamp = Date.now();

    const estimateRoadKm = (airKm: number) => {
      if (!Number.isFinite(airKm)) {
        return airKm;
      }

      const multiplier = airKm > 5 ? 1.28 : airKm > 2 ? 1.22 : 1.15;
      return Math.max(0.1, airKm * multiplier);
    };

    try {
      const response = await fetchFromApi(
        `/api/clinics/nearby?lat=${lat}&lng=${lng}&mode=${mode}&_t=${liveFetchStamp}`,
        {
          cache: 'no-store',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch nearby clinics');
      }

      const data = await response.json();
      const clinicsFromApi = Array.isArray(data.clinics) ? data.clinics : [];
      const externalProvider = String(data?.meta?.externalProvider || 'none');

      const registeredClinics = clinicsFromApi.filter((clinic: any) => clinic.registeredOnClinicQ);
      const doctorsByClinicId = new Map<string, Doctor[]>();

      await Promise.all(
        registeredClinics.map(async (clinic: any) => {
          try {
            const doctorResponse = await fetchFromApi(
              `/api/doctors?clinicId=${clinic.id}&_t=${liveFetchStamp}`,
              {
                cache: 'no-store',
              }
            );
            if (!doctorResponse.ok) {
              doctorsByClinicId.set(clinic.id, []);
              return;
            }

            const doctorData = await doctorResponse.json();
            const mappedDoctors: Doctor[] = (doctorData.doctors || []).map((doctor: any) => ({
              id: doctor._id,
              name: doctor.name,
              specialization: doctor.specialization,
              availability: 'Available today',
              queueCount: 0,
              avgWaitTime: 10,
            }));

            doctorsByClinicId.set(clinic.id, mappedDoctors);
          } catch {
            doctorsByClinicId.set(clinic.id, []);
          }
        })
      );

      const mappedClinics: Clinic[] = clinicsFromApi.map((clinic: any, index: number): Clinic | null => {
        const parsedDistanceKm = Number(clinic.distanceKm);
        if (!Number.isFinite(parsedDistanceKm) || parsedDistanceKm < 0) {
          return null;
        }

        const parsedLat = Number(clinic.location?.lat);
        const parsedLng = Number(clinic.location?.lng);
        const hasCoordinates = Number.isFinite(parsedLat) && Number.isFinite(parsedLng);

        const distance = Number(Math.max(0.1, parsedDistanceKm).toFixed(6));
        const roadDistanceForTravel = estimateRoadKm(distance);

        const registered = Boolean(clinic.registeredOnClinicQ);
        const providerStatus = clinic.status === 'busy' || clinic.status === 'closed' || clinic.status === 'open'
          ? clinic.status
          : 'busy';
        return {
          id: clinic.id || `clinic-${index + 1}`,
          name: clinic.name,
          address: clinic.address,
          distance,
          location: hasCoordinates ? { lat: parsedLat, lng: parsedLng } : undefined,
          travelTime: Math.max(5, Math.round(roadDistanceForTravel * 6)),
          rating: typeof clinic.rating === 'number' ? clinic.rating : 0,
          status: providerStatus,
          phone: clinic.phone || 'Not available',
          contactNumber: clinic.phone || 'Not available',
          operatingHours: clinic.operatingHours || 'Not available',
          facilityType: clinic.facilityType === 'hospital' ? 'hospital' : 'clinic',
          isRegistered: registered,
          doctors: registered ? doctorsByClinicId.get(clinic.id) || [] : [],
        };
      })
        .filter((clinic: Clinic | null): clinic is Clinic => clinic !== null)
        .sort((a: Clinic, b: Clinic) => a.distance - b.distance);

      // Enhance mapping for "wow" effect (add default placeholders or similar if needed)

      setModeCacheLocationKey(locationKey);
      setModeClinicsCache((prev) => ({
        ...prev,
        [mode]: mappedClinics,
      }));

      if (mode === discoveryMode) {
        setNearbyClinics(mappedClinics);
      }

      if (mappedClinics.length === 0) {
        if (externalProvider === 'osm') {
          setLocationError(
            mode === 'hospitals'
              ? 'No nearby hospitals found from OpenStreetMap for your current location.'
              : 'No nearby clinics found from OpenStreetMap for your current location.'
          );
        } else if (externalProvider === 'google') {
          setLocationError(
            mode === 'hospitals'
              ? 'No nearby hospitals found from Google Places for your current location.'
              : 'No nearby clinics found from Google Places for your current location.'
          );
        } else {
          setLocationError(
            mode === 'hospitals'
              ? 'No nearby hospitals found for your current location.'
              : 'No nearby clinics found for your current location.'
          );
        }
      } else {
        setLocationError('');
      }
    } catch (error) {
      console.error(error);
      if (!options?.backgroundRefresh && mode === discoveryMode) {
        setNearbyClinics([]);
        setLocationError('Could not fetch nearby clinics right now. Please try again.');
      }
    } finally {
      if (shouldShowLoading) {
        setIsLoadingClinics(false);
      }
    }
  };

  const handleDiscoveryModeChange = (nextMode: 'clinics' | 'hospitals') => {
    setDiscoveryMode(nextMode);

    if (!userLocation) {
      return;
    }

    const locationKey = `${userLocation.lat.toFixed(4)}:${userLocation.lng.toFixed(4)}`;
    if (modeCacheLocationKey === locationKey && modeClinicsCache[nextMode].length > 0) {
      setNearbyClinics(modeClinicsCache[nextMode]);
      setLocationError('');

      // Keep instant mode switch UX while silently refreshing stale cache.
      fetchNearbyClinics(userLocation.lat, userLocation.lng, {
        mode: nextMode,
        forceRefresh: true,
        backgroundRefresh: true,
      });
      return;
    }

    fetchNearbyClinics(userLocation.lat, userLocation.lng, { mode: nextMode });
  };

  useEffect(() => {
    if (!userLocation) {
      return;
    }

    if (activeTab !== 'home' && activeTab !== 'clinics') {
      return;
    }

    const refreshNearby = () => {
      fetchNearbyClinics(userLocation.lat, userLocation.lng, {
        mode: discoveryMode,
        forceRefresh: true,
        backgroundRefresh: true,
      });
    };

    refreshNearby();
    const intervalId = window.setInterval(refreshNearby, 30000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [activeTab, discoveryMode, userLocation?.lat, userLocation?.lng]);

  const requestLocationAccess = async (options?: { forceLive?: boolean }) => {
    if (!navigator.geolocation) {
      setLocationPermission('error');
      setLocationAccuracyMeters(null);
      setLocationError('Geolocation is not supported by your browser.');
      return;
    }

    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setLocationPermission('error');
      setLocationAccuracyMeters(null);
      setLocationError('Location requires a secure context. Open this app on https:// or localhost.');
      return;
    }

    try {
      if (navigator.permissions?.query) {
        const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
        if (status.state === 'denied') {
          setLocationPermission('denied');
          setLocationAccuracyMeters(null);
          setLocationError('Location permission is blocked in browser settings. Enable location for this site and tap Enable Location again.');
          return;
        }
      }
    } catch {
      // Continue with geolocation request even if permissions API is unavailable.
    }

    setLocationPermission('requesting');
    setLocationError('');

    let resolved = false;
    const failSafeTimer = window.setTimeout(() => {
      if (!resolved) {
        setLocationPermission('error');
        setLocationAccuracyMeters(null);
        setLocationError('Location request timed out. Please tap Enable Location again.');
      }
    }, 15000);

    const tryGetPosition = (options: PositionOptions) =>
      new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, options);
      });

    try {
      const primaryPosition = await tryGetPosition({
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      });

      const primaryAccuracyMeters = Number(primaryPosition.coords.accuracy);
      const isPrimaryAccurate =
        Number.isFinite(primaryAccuracyMeters) && primaryAccuracyMeters <= MAX_LOCATION_ACCURACY_METERS;

      if (isPrimaryAccurate) {
        resolved = true;
        window.clearTimeout(failSafeTimer);
        const lat = primaryPosition.coords.latitude;
        const lng = primaryPosition.coords.longitude;
        setLocationAccuracyMeters(primaryAccuracyMeters);
        setUserLocation({ lat, lng });
        setModeCacheLocationKey(null);
        setModeClinicsCache({ clinics: [], hospitals: [] });
        setLocationPermission('granted');
        fetchNearbyClinics(lat, lng, { mode: discoveryMode, forceRefresh: true });
        const alternateMode = discoveryMode === 'clinics' ? 'hospitals' : 'clinics';
        fetchNearbyClinics(lat, lng, { mode: alternateMode, forceRefresh: true });
        return;
      }
    } catch {
      // Retry with lower-accuracy settings for browsers/devices that fail high accuracy requests.
    }

    try {
      const fallbackPosition = await tryGetPosition({
        enableHighAccuracy: false,
        timeout: 15000,
        maximumAge: 60000,
      });

      const fallbackAccuracyMeters = Number(fallbackPosition.coords.accuracy);
      const isFallbackAccurate =
        Number.isFinite(fallbackAccuracyMeters) && fallbackAccuracyMeters <= MAX_LOCATION_ACCURACY_METERS;

      if (!isFallbackAccurate) {
        resolved = true;
        window.clearTimeout(failSafeTimer);
        setLocationPermission('error');
        setLocationAccuracyMeters(Number.isFinite(fallbackAccuracyMeters) ? fallbackAccuracyMeters : null);
        const accuracyText = Number.isFinite(fallbackAccuracyMeters)
          ? `${Math.round(fallbackAccuracyMeters)}m`
          : 'unknown';
        setLocationError(
          `Location accuracy is too low (${accuracyText}). Enable precise location/GPS and tap Refresh Location again.`
        );
        return;
      }

      resolved = true;
      window.clearTimeout(failSafeTimer);
      const lat = fallbackPosition.coords.latitude;
      const lng = fallbackPosition.coords.longitude;
      setLocationAccuracyMeters(fallbackAccuracyMeters);
      setUserLocation({ lat, lng });
      setModeCacheLocationKey(null);
      setModeClinicsCache({ clinics: [], hospitals: [] });
      setLocationPermission('granted');
      fetchNearbyClinics(lat, lng, { mode: discoveryMode, forceRefresh: true });
      const alternateMode = discoveryMode === 'clinics' ? 'hospitals' : 'clinics';
      fetchNearbyClinics(lat, lng, { mode: alternateMode, forceRefresh: true });
    } catch (error: any) {
      resolved = true;
      window.clearTimeout(failSafeTimer);

      if (error?.code === error?.PERMISSION_DENIED || error?.code === 1) {
        setLocationPermission('denied');
        setLocationAccuracyMeters(null);
        setLocationError('Location permission denied. Enable location in browser/site settings and tap Enable Location again.');
        return;
      }

      setLocationPermission('error');
      setLocationAccuracyMeters(null);
      setLocationError('Unable to fetch your location. Please check device location services and try again.');
    }
  };

  useEffect(() => {
    if (locationPermission === 'idle') {
      requestLocationAccess();
    }
  }, [locationPermission]);

  const to12HourTime = (time24: string) => {
    const [hourStr, minute] = time24.split(':');
    const hour = Number(hourStr);
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour % 12 === 0 ? 12 : hour % 12;
    return `${String(h12).padStart(2, '0')}:${minute} ${suffix}`;
  };

  const getAuthHeaders = () => {
    const token = localStorage.getItem('clinicq_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const loadPatientAppointments = useCallback(async () => {
    if (!patientPhone) {
      setAppointments([]);
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/appointments?phone=${encodeURIComponent(patientPhone)}`,
        { cache: 'no-store' }
      );

      if (!response.ok) {
        return;
      }

      const data = await response.json();
      const mappedAppointments: Appointment[] = (data.appointments || []).map((item: any) => {
        const timeRange = String(item.time || '');
        const parts = timeRange.split('-');
        const formattedTime =
          parts.length === 2
            ? `${to12HourTime(parts[0])}-${to12HourTime(parts[1])}`
            : timeRange || 'TBD';

        return {
          id: item.id,
          doctorId: item.doctorId,
          doctorName: item.doctorName,
          clinicId: item.clinicId,
          clinicName: item.clinicName,
          date: item.date || getLocalYmd(new Date(item.createdAt)),
          time: formattedTime,
          slotId: item.slotId || undefined,
          estimatedTravelMinutes: Number(item.estimatedTravelMinutes || 15),
          status: item.status,
        };
      });

      setAppointments(mappedAppointments);
    } catch {
      // Keep existing appointments if refresh fails.
    }
  }, [API_BASE_URL, patientPhone]);

  const syncQueueStatus = async (appointmentId: string) => {
    try {
      if (!patientPhone) {
        return;
      }

      const response = await fetch(
        `${API_BASE_URL}/api/appointments/${appointmentId}/queue-status?phone=${encodeURIComponent(patientPhone)}`,
        { cache: 'no-store' }
      );

      if (!response.ok) {
        return;
      }

      const data = await response.json();
      if (!data.inQueue) {
        setQueueStatus((prev) => ({
          ...prev,
          isInQueue: false,
          status: data.status === 'completed' ? 'completed' : 'not-checked-in',
        }));
        return;
      }

      setQueueStatus({
        isInQueue: true,
        token: data.tokenNumber,
        position: data.queuePosition,
        estimatedWaitMin: Number(data.estimatedWaitMin) || 0,
        estimatedWaitMax: Number(data.estimatedWaitMax) || 0,
        estimatedWait: Math.round(((Number(data.estimatedWaitMin) || 0) + (Number(data.estimatedWaitMax) || 0)) / 2),
        status: data.status === 'active' ? 'current' : 'waiting',
        checkedInTime: new Date(data.checkedInTime || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
    } catch {
      // Keep existing queue status if sync fails.
    }
  };

  // Background Sync: 15s intervals
  useEffect(() => {
    const syncAll = async () => {
      await loadPatientAppointments();
      if (activeQueueAppointmentId) {
        await syncQueueStatus(activeQueueAppointmentId);
      }
    };

    const pollTimer = setInterval(syncAll, 15000);
    return () => clearInterval(pollTimer);
  }, [loadPatientAppointments, activeQueueAppointmentId]);

  useEffect(() => {
    loadPatientAppointments();
  }, [loadPatientAppointments]);

  useEffect(() => {
    if (!selectedDoctorForBooking) {
      return;
    }

    let isCancelled = false;

    const loadSlots = async () => {
      setIsLoadingSlots(true);
      setSelectedSlotId(null);

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/slots?doctorId=${selectedDoctorForBooking.id}&date=${selectedDate}`,
          { headers: getAuthHeaders() }
        );

        if (!response.ok) {
          if (response.status === 404) {
            toast.error('Selected doctor is no longer available for booking');
            if (!isCancelled) {
              setSelectedDoctorForBooking(null);
            }
          }
          setAvailableSlots([]);
          return;
        }

        const data = await response.json();
        const slots = (data.slots || []).map((slot: any) => ({
          id: slot._id,
          startTime: slot.startTime,
          endTime: slot.endTime,
          capacity: slot.capacity,
          bookedCount: slot.bookedCount,
        }));

        if (!isCancelled) {
          setAvailableSlots(slots);
        }
      } catch {
        if (!isCancelled) {
          setAvailableSlots([]);
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingSlots(false);
        }
      }
    };

    loadSlots();

    return () => {
      isCancelled = true;
    };
  }, [API_BASE_URL, selectedDoctorForBooking, selectedDate]);

  useEffect(() => {
    if (activeQueueAppointmentId) {
      return;
    }

    const nextTrackableAppointment = [...appointments]
      .filter((apt) => apt.status === 'active' || apt.status === 'booked')
      .sort((a, b) => getAppointmentTimestamp(a) - getAppointmentTimestamp(b))
      .find((apt) => apt.status === 'active' || Date.now() >= getQueueTriggerTimestamp(apt));

    if (!nextTrackableAppointment) {
      return;
    }

    setActiveQueueDoctorId(nextTrackableAppointment.doctorId);
    setActiveQueueAppointmentId(nextTrackableAppointment.id);
    syncQueueStatus(nextTrackableAppointment.id);
  }, [appointments, activeQueueAppointmentId]);

  useEffect(() => {
    if (!activeQueueDoctorId) {
      return;
    }

    const socket = io(API_BASE_URL, { transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('joinDoctorRoom', activeQueueDoctorId);
    });

    socket.on('queueUpdated', (queue: any[]) => {
      const queueEntry = queue.find((item) => {
        if (activeQueueAppointmentId) {
          return item._id === activeQueueAppointmentId;
        }
        return item.patientName === patientDisplayName;
      });

      if (!queueEntry) {
        return;
      }

      setQueueStatus({
        isInQueue: true,
        token: queueEntry.tokenNumber,
        position: queueEntry.queuePosition,
        estimatedWaitMin: Number(queueEntry.estimatedWaitMin) || 0,
        estimatedWaitMax: Number(queueEntry.estimatedWaitMax) || 0,
        estimatedWait: Math.round(((Number(queueEntry.estimatedWaitMin) || 0) + (Number(queueEntry.estimatedWaitMax) || 0)) / 2),
        status: queueEntry.status === 'active' ? 'current' : 'waiting',
        checkedInTime: new Date(queueEntry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
    });

    return () => {
      socket.emit('leaveDoctorRoom', activeQueueDoctorId);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [API_BASE_URL, activeQueueDoctorId, activeQueueAppointmentId, user?.fullName, user?.username]);

  useEffect(() => {
    if (!activeQueueAppointmentId) {
      return;
    }

    const trackedAppointment = appointments.find((apt) => apt.id === activeQueueAppointmentId);
    if (!trackedAppointment) {
      return;
    }

    if (trackedAppointment.status === 'completed' || trackedAppointment.status === 'cancelled') {
      setQueueStatus({
        isInQueue: false,
        status: trackedAppointment.status === 'completed' ? 'completed' : 'not-checked-in',
      });
      setActiveQueueDoctorId(null);
      setActiveQueueAppointmentId(null);
    }
  }, [appointments, activeQueueAppointmentId]);

  useEffect(() => {
    if (!activeQueueAppointmentId) {
      return;
    }

    const trackedAppointment = appointments.find((apt) => apt.id === activeQueueAppointmentId);
    const minutesUntilSlot = trackedAppointment
      ? Math.max(0, Math.round((getAppointmentTimestamp(trackedAppointment) - Date.now()) / (60 * 1000)))
      : Number.POSITIVE_INFINITY;

    const intervalMs =
      queueStatus.status === 'current' || (queueStatus.position || Number.POSITIVE_INFINITY) <= 2
        ? 5000
        : minutesUntilSlot <= 20
          ? 10000
          : 30000;

    const intervalId = window.setInterval(() => {
      syncQueueStatus(activeQueueAppointmentId);
    }, intervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [appointments, activeQueueAppointmentId, queueStatus.position, queueStatus.status]);

  const handleToggleFavorite = (clinicId: string) => {
    setFavoriteClinicIds(prev =>
      prev.includes(clinicId)
        ? prev.filter(id => id !== clinicId)
        : [...prev, clinicId]
    );
  };

  const handleViewClinicDetails = (clinic: Clinic) => {
    setSelectedClinic(clinic);
    setSelectedDoctorForBooking(null);
    setSelectedSlotId(null);
    setAvailableSlots([]);
    setShowClinicDetails(true);
  };

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const sortClinicsByDistance = (clinics: Clinic[]) =>
    [...clinics].sort((a, b) => {
      const aDistance = typeof a.distance === 'number' ? a.distance : Number.POSITIVE_INFINITY;
      const bDistance = typeof b.distance === 'number' ? b.distance : Number.POSITIVE_INFINITY;
      return aDistance - bDistance;
    });

  const sortedNearbyClinics = sortClinicsByDistance(nearbyClinics);
  const filteredClinics = normalizedQuery
    ? sortedNearbyClinics.filter((clinic) => {
      const clinicNameMatch = (clinic.name || '').toLowerCase().includes(normalizedQuery);
      const clinicAddressMatch = (clinic.address || '').toLowerCase().includes(normalizedQuery);
      const doctorMatch = (clinic.doctors || []).some((doctor) =>
        `${doctor.name || ''} ${doctor.specialization || ''}`.toLowerCase().includes(normalizedQuery)
      );

      return clinicNameMatch || clinicAddressMatch || doctorMatch;
    })
    : sortedNearbyClinics;

  const favoriteClinics = filteredClinics.filter(c => favoriteClinicIds.includes(c.id));

  const upcomingAppointments = [...appointments.filter((apt) => apt.status === 'booked' || apt.status === 'active')]
    .sort((a, b) => getAppointmentTimestamp(a) - getAppointmentTimestamp(b));
  const pastAppointments = [...appointments.filter((apt) => apt.status === 'completed' || apt.status === 'cancelled')]
    .sort((a, b) => getAppointmentTimestamp(b) - getAppointmentTimestamp(a));
  const patientInitial = patientDisplayName.charAt(0).toUpperCase();

  if (locationPermission !== 'granted') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6 relative overflow-hidden">
        {/* Decorative background */}
        <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] rounded-full bg-teal-500/10 dark:bg-teal-900/20 blur-[100px] animate-pulse-slow"></div>
        <div className="absolute bottom-[-20%] right-[-20%] w-[80%] h-[80%] rounded-full bg-indigo-500/5 dark:bg-indigo-900/10 blur-[100px] animate-pulse-slow" style={{ animationDelay: '-5s' }}></div>

        <Card className="w-full max-w-lg relative z-10 shadow-2xl overflow-hidden border border-border">
          <div className="h-1.5 bg-gradient-to-r from-teal-500 to-cyan-500 w-full" />
          <CardHeader className="pt-8 text-center">
            <div className="mx-auto w-16 h-16 bg-teal-100 dark:bg-teal-500/10 rounded-2xl flex items-center justify-center mb-4 border border-teal-200 dark:border-teal-500/20">
              <MapPin className="w-8 h-8 text-teal-600 dark:text-teal-400" />
            </div>
            <CardTitle className="text-3xl font-heading font-bold tracking-tight">Precise Care Nearby</CardTitle>
            <CardDescription className="text-muted-foreground text-base font-medium mt-2">
              ClinicQ uses real-time location to find the best healthcare facilities and live queue updates for you.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pb-10 text-center">
            <div className="bg-muted/50 border border-border rounded-2xl p-6">
              <p className="text-sm font-medium text-muted-foreground leading-relaxed">
                {locationPermission === 'requesting'
                  ? 'Requesting temporary location access...'
                  : locationPermission === 'denied'
                    ? 'Location access is currently blocked. To continue, please enable location in your browser settings and refresh.'
                    : locationPermission === 'error'
                      ? (locationError || 'We encountered an error accessing your location. Please ensure GPS is active.')
                      : 'Please grant location permission to view clinics and hospitals in your immediate area.'}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                onClick={() => requestLocationAccess()}
                disabled={locationPermission === 'requesting'}
                className="w-full sm:w-auto px-8 h-12 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-teal-500/10"
              >
                {locationPermission === 'requesting' ? 'Connecting...' : 'Enable Precise Location'}
              </Button>
              <Button variant="outline" onClick={onLogout}>
                Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-[#020617]/80 backdrop-blur-md border-b border-white/10 dark:border-white/5 px-8 md:px-12 py-5">
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
                <p className="text-[10px] text-teal-600 dark:text-teal-400 font-bold uppercase tracking-widest mt-0.5">Care Portal</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="hidden md:flex items-center space-x-2">
              <span className="text-sm font-medium">{patientDisplayName}</span>
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
            className="fixed inset-0 bg-black/50 z-20 md:hidden" 
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
        
        {/* Sidebar */}
        <aside className={`fixed lg:sticky top-20 left-0 bottom-0 w-64 h-[calc(100vh-5rem)] bg-card border-r border-border overflow-y-auto transition-transform duration-300 z-40 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
          <nav className="p-8 md:p-12">
            <div className="space-y-2">
              <Button
                variant={activeTab === 'home' ? 'default' : 'ghost'}
                className={`w-full justify-start min-h-[2.75rem] h-auto py-2.5 px-4 rounded-xl transition-all ${activeTab === 'home'
                    ? 'bg-teal-600 hover:bg-teal-700 text-white'
                    : 'hover:bg-muted'
                  }`}
                onClick={() => { setActiveTab('home'); setIsSidebarOpen(false); }}
              >
                <div className="flex items-start min-w-0">
                  <Home className={`w-5 h-5 mr-3 mt-0.5 flex-shrink-0 ${activeTab === 'home' ? 'text-white' : 'text-teal-600'}`} />
                  <span className="font-semibold text-left whitespace-normal leading-tight">Dashboard</span>
                </div>
              </Button>

              <Button
                variant={activeTab === 'clinics' ? 'default' : 'ghost'}
                className={`w-full justify-start min-h-[2.75rem] h-auto py-2.5 px-4 rounded-xl transition-all ${activeTab === 'clinics'
                    ? 'bg-teal-600 hover:bg-teal-700 text-white'
                    : 'hover:bg-muted'
                  }`}
                onClick={() => { setActiveTab('clinics'); setIsSidebarOpen(false); }}
              >
                <div className="flex items-start min-w-0">
                  <Building className={`w-5 h-5 mr-3 mt-0.5 flex-shrink-0 ${activeTab === 'clinics' ? 'text-white' : 'text-teal-600'}`} />
                  <span className="font-semibold text-left whitespace-normal leading-tight">Explore Clinics</span>
                </div>
              </Button>

              <Button
                variant={activeTab === 'appointments' ? 'default' : 'ghost'}
                className={`w-full justify-start min-h-[2.75rem] h-auto py-2.5 px-4 rounded-xl transition-all ${activeTab === 'appointments'
                    ? 'bg-teal-600 hover:bg-teal-700 text-white'
                    : 'hover:bg-muted'
                  }`}
                onClick={() => { setActiveTab('appointments'); setIsSidebarOpen(false); }}
              >
                <div className="flex items-start min-w-0">
                  <Calendar className={`w-5 h-5 mr-3 mt-0.5 flex-shrink-0 ${activeTab === 'appointments' ? 'text-white' : 'text-teal-600'}`} />
                  <span className="font-semibold text-left whitespace-normal leading-tight">Appointments</span>
                </div>
              </Button>

              <Button
                variant={activeTab === 'queue' ? 'default' : 'ghost'}
                className={`w-full justify-start min-h-[2.75rem] h-auto py-2.5 px-4 rounded-xl transition-all ${activeTab === 'queue'
                    ? 'bg-teal-600 hover:bg-teal-700 text-white'
                    : 'hover:bg-muted'
                  }`}
                onClick={() => { setActiveTab('queue'); setIsSidebarOpen(false); }}
              >
                <div className="flex items-start min-w-0">
                  <Clock className={`w-5 h-5 mr-3 mt-0.5 flex-shrink-0 ${activeTab === 'queue' ? 'text-white' : 'text-teal-600'}`} />
                  <span className="font-semibold text-left whitespace-normal leading-tight">Live Queue</span>
                </div>
              </Button>

              <Button
                variant={activeTab === 'settings' ? 'default' : 'ghost'}
                className={`w-full justify-start min-h-[2.75rem] h-auto py-2.5 px-4 rounded-xl transition-all ${activeTab === 'settings'
                    ? 'bg-teal-600 hover:bg-teal-700 text-white'
                    : 'hover:bg-muted'
                  }`}
                onClick={() => { setActiveTab('settings'); setIsSidebarOpen(false); }}
              >
                <div className="flex items-start min-w-0">
                  <Settings className={`w-5 h-5 mr-3 mt-0.5 flex-shrink-0 ${activeTab === 'settings' ? 'text-white' : 'text-teal-600'}`} />
                  <span className="font-semibold text-left whitespace-normal leading-tight">Settings</span>
                </div>
              </Button>
            </div>
          </nav>
        </aside>

        {/* Main Content - Scrollable */}
        <main className="flex-1 w-full md:w-[calc(100%-16rem)] p-8 md:p-12 overflow-y-auto bg-slate-50 dark:bg-[#020617] transition-all">
          {activeTab === 'home' && (
            <div className="space-y-6">
              {/* Elegant Welcome Banner */}
              <div className="relative overflow-hidden bg-white dark:bg-slate-900 p-8 md:p-12 rounded-[2.5rem] border border-white/20 dark:border-white/5 shadow-xl shadow-slate-200/50 dark:shadow-none">
                {/* Abstract deco shapes instead of childish pulses */}
                <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-teal-500/5 rounded-full blur-[100px] -mr-32 -mt-32"></div>
                <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-indigo-500/5 rounded-full blur-[100px] -ml-32 -mb-32"></div>

                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
                  <div className="max-w-xl">
                    <span className="inline-flex items-center px-4 py-1.5 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400 text-xs font-bold uppercase tracking-widest mb-6">
                      Welcome to your Care Portal
                    </span>
                    <h2 className="text-4xl md:text-5xl font-black mb-4 font-heading tracking-tight leading-tight text-slate-900 dark:text-white">
                      Hello, {patientDisplayName}.
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-lg font-medium leading-relaxed">
                      Optimize your health journey today. Access nearby clinics, manage appointments, and track your queue live.
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 min-w-[200px]">
                    <Button
                      variant="default"
                      size="lg"
                      className="bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-2xl h-14 shadow-lg shadow-teal-500/20 px-8"
                      onClick={() => requestLocationAccess({ forceLive: true })}
                      disabled={isLoadingClinics}
                    >
                      <MapPin className="w-5 h-5 mr-3" />
                      {isLoadingClinics ? 'Updating Location...' : 'Refresh Network'}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Nearby Clinics Section */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold">
                      {discoveryMode === 'hospitals' ? 'Nearby Hospitals' : 'Nearby Clinics'}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {discoveryMode === 'hospitals'
                        ? 'Find nearby hospitals in your area'
                        : 'Find and book appointments at nearby clinics'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                      <span>Clinics</span>
                      <Switch
                        checked={discoveryMode === 'hospitals'}
                        onCheckedChange={(checked: boolean) => handleDiscoveryModeChange(checked ? 'hospitals' : 'clinics')}
                      />
                      <span>Hospitals</span>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setActiveTab('clinics')}>
                      View All
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {sortedNearbyClinics.slice(0, 4).map((clinic) => (
                    <ClinicCard
                      key={clinic.id}
                      clinic={clinic}
                      isFavorite={favoriteClinicIds.includes(clinic.id)}
                      onToggleFavorite={handleToggleFavorite}
                      onViewDetails={handleViewClinicDetails}
                    />
                  ))}
                </div>
              </div>

              {/* Queue Status */}
              {queueStatus.isInQueue && (
                <Card className="border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-950">
                  <CardHeader>
                    <CardTitle className="text-teal-900 dark:text-teal-100">Your Queue Status</CardTitle>
                    <CardDescription className="text-teal-700 dark:text-teal-300">
                      You're currently in the queue
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-teal-700 dark:text-teal-300">Token</p>
                        <p className="text-xl font-bold text-teal-900 dark:text-teal-100">{queueStatus.token}</p>
                      </div>
                      <div>
                        <p className="text-sm text-teal-700 dark:text-teal-300">Position</p>
                        <p className="text-xl font-bold text-teal-900 dark:text-teal-100">#{queueStatus.position}</p>
                      </div>
                      <div>
                        <p className="text-sm text-teal-700 dark:text-teal-300">Est. Wait</p>
                        <p className="text-xl font-bold text-teal-900 dark:text-teal-100">{queueStatus.estimatedWait}m</p>
                        {(Number.isFinite(queueStatus.estimatedWaitMin) || Number.isFinite(queueStatus.estimatedWaitMax)) && (
                          <p className="text-xs text-teal-700 dark:text-teal-300 mt-1">
                            Range: {Math.max(0, Number(queueStatus.estimatedWaitMin || 0))}-{Math.max(0, Number(queueStatus.estimatedWaitMax || 0))}m
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {activeTab === 'clinics' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-2">
                  {discoveryMode === 'hospitals' ? 'Find Hospitals' : 'Find Clinics'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {discoveryMode === 'hospitals'
                    ? 'Discover nearby hospitals based on your location'
                    : 'Discover nearby clinics and book appointments'}
                </p>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder="Search clinics, doctors, or specialties..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <p className="font-semibold">Location-Based Clinics</p>
                      <p className="text-sm text-muted-foreground">
                        {discoveryMode === 'hospitals'
                          ? 'Showing nearby hospitals around your current location.'
                          : 'Showing nearby clinics around your current location.'}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground mr-2">
                        <span>Clinics</span>
                        <Switch
                          checked={discoveryMode === 'hospitals'}
                          onCheckedChange={(checked: boolean) => handleDiscoveryModeChange(checked ? 'hospitals' : 'clinics')}
                        />
                        <span>Hospitals</span>
                      </div>
                      <Button onClick={() => requestLocationAccess({ forceLive: true })} disabled={isLoadingClinics}>
                        {isLoadingClinics
                          ? 'Loading...'
                          : discoveryMode === 'hospitals'
                            ? 'Refresh Nearby Hospitals'
                            : 'Refresh Nearby Clinics'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Favorites */}
              {favoriteClinics.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center">
                    <Heart className="w-5 h-5 text-red-500 fill-current mr-2" />
                    Favorite Clinics
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {favoriteClinics.map((clinic) => (
                      <ClinicCard
                        key={clinic.id}
                        clinic={clinic}
                        isFavorite={true}
                        onToggleFavorite={handleToggleFavorite}
                        onViewDetails={handleViewClinicDetails}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* All Clinics */}
              <div>
                <h3 className="text-lg font-semibold mb-3">All Clinics</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredClinics.map((clinic) => (
                    <ClinicCard
                      key={clinic.id}
                      clinic={clinic}
                      isFavorite={favoriteClinicIds.includes(clinic.id)}
                      onToggleFavorite={handleToggleFavorite}
                      onViewDetails={handleViewClinicDetails}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'appointments' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-2">My Appointments</h2>
                <p className="text-sm text-muted-foreground">Track upcoming visits and review past appointments</p>
                <p className="text-xs text-muted-foreground mt-1">Live queue updates start automatically at 15 min + travel time before your slot. Check-in is optional.</p>
              </div>

              {appointments.length > 0 ? (
                <div className="space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Upcoming</h3>
                    {upcomingAppointments.length > 0 ? (
                      upcomingAppointments.map((apt) => (
                        <Card key={apt.id} className="overflow-hidden">
                          <div className="flex flex-col md:flex-row md:items-center justify-between p-6">
                            <div className="flex items-start space-x-4 mb-4 md:mb-0">
                              <div className="w-12 h-12 bg-teal-100 dark:bg-teal-900 rounded-full flex items-center justify-center shrink-0">
                                <Calendar className="w-6 h-6 text-teal-600 dark:text-teal-400" />
                              </div>
                              <div>
                                <h3 className="font-bold text-lg">{apt.doctorName}</h3>
                                <p className="text-sm text-muted-foreground mb-1">{apt.clinicName}</p>
                                <div className="flex items-center text-sm font-medium">
                                  <Calendar className="w-4 h-4 mr-1 text-teal-600" />
                                  <span className="mr-3">{apt.date}</span>
                                  <Clock className="w-4 h-4 mr-1 text-teal-600" />
                                  <span>{apt.time}</span>
                                </div>
                                {apt.status === 'booked' && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {isAutoQueueWindowOpen(apt)
                                      ? 'Live queue updates are active for this appointment.'
                                      : `Live updates will start automatically around ${15 + Math.max(0, Number(apt.estimatedTravelMinutes || 15))} minutes before slot.`}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                              <Badge
                                variant="outline"
                                className={`justify-center py-1 ${apt.status === 'booked' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                    apt.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' :
                                      apt.status === 'cancelled' ? 'bg-red-50 text-red-700 border-red-200' :
                                        'bg-gray-50 text-gray-700 border-gray-200'
                                  }`}
                              >
                                {apt.status === 'active' ? 'In Progress' : apt.status.charAt(0).toUpperCase() + apt.status.slice(1)}
                              </Badge>

                              {apt.status === 'booked' && (
                                <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    className="w-full sm:w-auto border-red-200 text-red-600 hover:bg-red-50"
                                    onClick={async () => {
                                      if (!patientPhone) {
                                        toast.error('Phone number is required to cancel appointment');
                                        return;
                                      }

                                      const response = await fetch(`${API_BASE_URL}/api/appointments/${apt.id}/cancel`, {
                                        method: 'POST',
                                        headers: getAuthHeaders(),
                                        body: JSON.stringify({ phone: patientPhone }),
                                      });
                                      const data = await response.json();

                                      if (!response.ok) {
                                        toast.error(data.message || 'Unable to cancel appointment');
                                        return;
                                      }

                                      await loadPatientAppointments();
                                      toast.success('Appointment cancelled');
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    className="w-full sm:w-auto bg-teal-600 hover:bg-teal-700 text-white"
                                    onClick={async () => {
                                      if (!patientPhone) {
                                        toast.error('Phone number is required to check in');
                                        return;
                                      }

                                      const response = await fetch(`${API_BASE_URL}/api/appointments/${apt.id}/checkin`, {
                                        method: 'POST',
                                        headers: getAuthHeaders(),
                                        body: JSON.stringify({ phone: patientPhone }),
                                      });
                                      const data = await response.json();

                                      if (!response.ok) {
                                        toast.error(data.message || 'Unable to check in');
                                        return;
                                      }

                                      toast.success('Checked in successfully!');

                                      setActiveQueueDoctorId(apt.doctorId);
                                      setActiveQueueAppointmentId(apt.id);
                                      setQueueStatus({
                                        isInQueue: true,
                                        token: data?.queue?.tokenNumber,
                                        position: data?.queue?.queuePosition,
                                        estimatedWaitMin: Number(data?.queue?.estimatedWaitMin) || 0,
                                        estimatedWaitMax: Number(data?.queue?.estimatedWaitMax) || 0,
                                        estimatedWait: Math.round(((Number(data?.queue?.estimatedWaitMin) || 0) + (Number(data?.queue?.estimatedWaitMax) || 0)) / 2),
                                        status: data?.queue?.status === 'active' ? 'current' : 'waiting',
                                        checkedInTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                                      });
                                      await loadPatientAppointments();
                                      setActiveTab('queue');
                                    }}
                                  >
                                    Check In (Optional)
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        </Card>
                      ))
                    ) : (
                      <Card>
                        <CardContent className="text-center py-8">
                          <p className="text-sm text-muted-foreground">No upcoming appointments.</p>
                        </CardContent>
                      </Card>
                    )}
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Past</h3>
                    {pastAppointments.length > 0 ? (
                      pastAppointments.map((apt) => (
                        <Card key={apt.id} className="overflow-hidden">
                          <div className="flex flex-col md:flex-row md:items-center justify-between p-6">
                            <div className="flex items-start space-x-4 mb-4 md:mb-0">
                              <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center shrink-0">
                                <Calendar className="w-6 h-6 text-muted-foreground" />
                              </div>
                              <div>
                                <h3 className="font-bold text-lg">{apt.doctorName}</h3>
                                <p className="text-sm text-muted-foreground mb-1">{apt.clinicName}</p>
                                <div className="flex items-center text-sm font-medium">
                                  <Calendar className="w-4 h-4 mr-1 text-muted-foreground" />
                                  <span className="mr-3">{apt.date}</span>
                                  <Clock className="w-4 h-4 mr-1 text-muted-foreground" />
                                  <span>{apt.time}</span>
                                </div>
                              </div>
                            </div>
                            <Badge
                              variant="outline"
                              className={`justify-center py-1 ${apt.status === 'cancelled'
                                  ? 'bg-red-50 text-red-700 border-red-200'
                                  : 'bg-gray-50 text-gray-700 border-gray-200'
                                }`}
                            >
                              {apt.status.charAt(0).toUpperCase() + apt.status.slice(1)}
                            </Badge>
                          </div>
                        </Card>
                      ))
                    ) : (
                      <Card>
                        <CardContent className="text-center py-8">
                          <p className="text-sm text-muted-foreground">No past appointments yet.</p>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </div>
              ) : (
                <Card>
                  <CardContent className="text-center py-12">
                    <Calendar className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <h3 className="text-lg font-semibold mb-2">No Appointments Yet</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Book an appointment with a clinic to see it here.
                    </p>
                    <Button onClick={() => setActiveTab('clinics')} className="bg-teal-600 hover:bg-teal-700">
                      Find Clinics
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {activeTab === 'queue' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-2">My Queue</h2>
                <p className="text-sm text-muted-foreground">Track your position in the queue</p>
              </div>

              {queueStatus.isInQueue ? (
                <Card className="border-teal-200 dark:border-teal-800">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Queue Status</CardTitle>
                        <CardDescription>Checked in at {queueStatus.checkedInTime}</CardDescription>
                      </div>
                      <Badge className="bg-teal-600 text-white">Active</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                      <div className="text-center p-4 bg-muted rounded-lg">
                        <p className="text-sm text-muted-foreground mb-1">Token Number</p>
                        <p className="text-3xl font-bold">{queueStatus.token}</p>
                      </div>
                      <div className="text-center p-4 bg-muted rounded-lg">
                        <p className="text-sm text-muted-foreground mb-1">Position</p>
                        <p className="text-3xl font-bold">#{queueStatus.position}</p>
                      </div>
                      <div className="text-center p-4 bg-muted rounded-lg">
                        <p className="text-sm text-muted-foreground mb-1">Est. Wait</p>
                        <p className="text-3xl font-bold">{queueStatus.estimatedWait}m</p>
                        {(Number.isFinite(queueStatus.estimatedWaitMin) || Number.isFinite(queueStatus.estimatedWaitMax)) && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Range: {Math.max(0, Number(queueStatus.estimatedWaitMin || 0))}-{Math.max(0, Number(queueStatus.estimatedWaitMax || 0))}m
                          </p>
                        )}
                      </div>
                    </div>
                    <Alert className="border-teal-200 bg-teal-50 dark:bg-teal-950 dark:border-teal-800">
                      <AlertDescription className="text-teal-800 dark:text-teal-200">
                        Please stay nearby. You'll be notified when it's your turn.
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="text-center py-12">
                    <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <h3 className="text-lg font-semibold mb-2">Not in Queue</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      You're not currently in any queue. Find a clinic to join.
                    </p>
                    <Button onClick={() => setActiveTab('clinics')} className="bg-teal-600 hover:bg-teal-700">
                      Find Clinics
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-2">Settings</h2>
                <p className="text-sm text-muted-foreground">Customize your experience</p>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Appearance</CardTitle>
                  <CardDescription>Customize how the app looks</CardDescription>
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
                  <CardTitle>Profile Information</CardTitle>
                  <CardDescription>Your account details</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">Name</Label>
                    <p className="text-sm text-muted-foreground mt-1">{user?.fullName || 'Not set'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Username</Label>
                    <p className="text-sm text-muted-foreground mt-1">{user?.username}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </main>
      </div>

      {/* Clinic Details Dialog */}
      <Dialog open={showClinicDetails} onOpenChange={setShowClinicDetails}>
        <DialogContent className="max-w-4xl h-[95vh] md:h-[85vh] flex flex-col p-0 overflow-hidden glass-premium bg-white/95 dark:bg-slate-900/95 border-white/20">
          <DialogHeader className="p-8 pb-6 border-b border-slate-100 dark:border-white/5 shrink-0">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-6">
                <div className="w-20 h-20 bg-gradient-to-br from-teal-500 to-teal-700 rounded-3xl flex items-center justify-center shadow-2xl shadow-teal-500/20">
                  <Building className="w-10 h-10 text-white" />
                </div>
                <div>
                  <div className="flex items-center flex-wrap gap-3 mb-2">
                    <DialogTitle className="text-3xl font-black font-heading tracking-tight leading-none text-slate-900 dark:text-white">
                      {selectedClinic?.name}
                    </DialogTitle>
                    {!selectedClinic?.isRegistered && (
                      <Badge className="bg-slate-100 text-slate-600 border-slate-200 px-3 py-1 font-bold text-[10px] uppercase tracking-widest" variant="outline">
                        Unregistered
                      </Badge>
                    )}
                  </div>
                  <DialogDescription className="flex items-center text-slate-500 dark:text-slate-400 font-medium">
                    <MapPin className="w-5 h-5 mr-2 text-teal-500" />
                    {selectedClinic?.address}
                  </DialogDescription>
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">

            <div className="space-y-8 py-2">
              {/* Alert for Public Clinics */}
              {!selectedClinic?.isRegistered && (
                <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800">
                  <AlertDescription className="text-amber-800 dark:text-amber-200">
                    This clinic is not a registered ClinicQ partner. Booking and queue tracking features are not available for this location. Please contact the clinic directly to schedule an appointment.
                  </AlertDescription>
                </Alert>
              )}

              {/* Show Booking View if doctor selected, else show Clinic Details */}
              {selectedDoctorForBooking ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                  <Button variant="ghost" className="mb-2 -ml-2" onClick={() => { setSelectedDoctorForBooking(null); setSelectedSlotId(null); setAvailableSlots([]); }}>
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Back to Clinic
                  </Button>

                  <div className="flex items-center space-x-4 p-4 bg-muted/30 rounded-xl border border-border">
                    <div className="w-12 h-12 bg-teal-100 dark:bg-teal-900/50 rounded-full flex items-center justify-center">
                      <Stethoscope className="w-6 h-6 text-teal-600 dark:text-teal-400" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">{selectedDoctorForBooking.name}</h3>
                      <p className="text-sm text-muted-foreground">{selectedDoctorForBooking.specialization}</p>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-3">Select Date</h4>
                    <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-hide">
                      {[0, 1, 2, 3, 4, 5, 6].map(offset => {
                        const d = new Date();
                        d.setDate(d.getDate() + offset);
                        const dateStr = getLocalYmd(d);
                        const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
                        const dayNum = d.getDate();
                        return (
                          <button
                            key={dateStr}
                            onClick={() => { setSelectedDate(dateStr); setSelectedSlotId(null); }}
                            className={`flex-shrink-0 flex flex-col items-center justify-center w-16 h-20 rounded-xl border-2 transition-all ${selectedDate === dateStr
                                ? 'border-teal-600 bg-teal-50 text-teal-900 dark:bg-teal-900/30 dark:text-teal-100'
                                : 'border-transparent bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground'
                              }`}
                          >
                            <span className="text-xs font-medium uppercase">{dayName}</span>
                            <span className="text-xl font-bold">{dayNum}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-3">Available Slots</h4>
                    {isLoadingSlots ? (
                      <p className="text-sm text-muted-foreground">Loading slots...</p>
                    ) : availableSlots.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No slots available for selected date.</p>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                        {availableSlots.map((slot) => {
                          const isAvailable = slot.bookedCount < slot.capacity;
                          const label = `${to12HourTime(slot.startTime)}-${to12HourTime(slot.endTime)}`;

                          return (
                            <button
                              key={slot.id}
                              disabled={!isAvailable}
                              onClick={() => setSelectedSlotId(slot.id)}
                              className={`p-2 rounded-lg text-sm font-medium border-2 transition-all ${!isAvailable
                                  ? 'bg-gray-100 border-gray-200 text-gray-400 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-500 cursor-not-allowed'
                                  : selectedSlotId === slot.id
                                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                    : 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400 cursor-pointer'
                                }`}
                            >
                              <div>{label}</div>
                              <div className="text-[10px] mt-1">{slot.capacity - slot.bookedCount} left</div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {selectedSlotId && (
                    <Card className="border-teal-200 dark:border-teal-800 mt-6 bg-teal-50/50 dark:bg-teal-900/10">
                      <CardContent className="p-4">
                        <h4 className="font-semibold mb-2">Booking Summary</h4>
                        {(() => {
                          const selectedSlot = availableSlots.find((slot) => slot.id === selectedSlotId);
                          const slotLabel = selectedSlot
                            ? `${to12HourTime(selectedSlot.startTime)}-${to12HourTime(selectedSlot.endTime)}`
                            : 'N/A';
                          return (
                            <div className="space-y-1 text-sm mb-4">
                              <p className="flex justify-between"><span className="text-muted-foreground">Doctor:</span> <span className="font-medium">{selectedDoctorForBooking.name}</span></p>
                              <p className="flex justify-between"><span className="text-muted-foreground">Date:</span> <span className="font-medium">{selectedDate}</span></p>
                              <p className="flex justify-between"><span className="text-muted-foreground">Time:</span> <span className="font-medium">{slotLabel}</span></p>
                            </div>
                          );
                        })()}
                        <Button
                          className="w-full bg-teal-600 hover:bg-teal-700 text-white"
                          onClick={async () => {
                            if (!selectedClinic || !selectedDoctorForBooking || !selectedSlotId) {
                              return;
                            }

                            try {
                              const response = await fetch(`${API_BASE_URL}/api/appointments`, {
                                method: 'POST',
                                headers: getAuthHeaders(),
                                body: JSON.stringify({
                                  patientName: patientDisplayName,
                                  phone: user?.phone || '+10000000000',
                                  doctorId: selectedDoctorForBooking.id,
                                  slotId: selectedSlotId,
                                  estimatedTravelMinutes: selectedClinic.travelTime,
                                }),
                              });

                              const data = await response.json();

                              if (!response.ok) {
                                toast.error(data.message || 'Failed to book appointment');
                                return;
                              }

                              const selectedSlot = availableSlots.find((slot) => slot.id === selectedSlotId);
                              const timeLabel = selectedSlot
                                ? `${to12HourTime(selectedSlot.startTime)}-${to12HourTime(selectedSlot.endTime)}`
                                : 'Slot Booked';

                              const newApt: Appointment = {
                                id: data.appointment._id,
                                doctorId: selectedDoctorForBooking.id,
                                doctorName: selectedDoctorForBooking.name,
                                clinicId: selectedClinic.id,
                                clinicName: selectedClinic.name,
                                date: selectedDate,
                                time: timeLabel,
                                slotId: selectedSlotId,
                                tokenNumber: data.tokenNumber,
                                estimatedTravelMinutes: selectedClinic.travelTime,
                                status: 'booked',
                              };

                              setAppointments((prev) => [...prev, newApt]);

                              toast.success('Appointment booked successfully!');
                              await loadPatientAppointments();
                              setShowClinicDetails(false);
                              setSelectedDoctorForBooking(null);
                              setSelectedSlotId(null);
                              setAvailableSlots([]);
                              setActiveTab('appointments');
                            } catch {
                              toast.error('Unable to connect to booking service');
                            }
                          }}
                        >
                          Book Appointment
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </div>
              ) : (
                <>
                  {/* Clinic Info - More prominent */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-6 bg-gradient-to-br from-muted/50 to-muted rounded-xl border-2 border-border">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-background rounded-lg flex items-center justify-center">
                        <Phone className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Phone</p>
                        <p className="text-sm font-semibold">{selectedClinic?.contactNumber}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-background rounded-lg flex items-center justify-center">
                        <Clock className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Hours</p>
                        <p className="text-sm font-semibold">{selectedClinic?.operatingHours}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-background rounded-lg flex items-center justify-center">
                        <Star className="w-5 h-5 text-yellow-500 fill-current" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Rating</p>
                        <p className="text-sm font-semibold">
                          {selectedClinic && selectedClinic.rating > 0 ? `${selectedClinic.rating.toFixed(1)} / 5.0` : 'N/A'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-background rounded-lg flex items-center justify-center">
                        <Car className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Distance</p>
                        <p className="text-sm font-semibold">{selectedClinic?.distance.toFixed(1)} km • {selectedClinic?.travelTime} min</p>
                      </div>
                    </div>
                  </div>

                  {/* Doctors List - More subtle */}
                  {selectedClinic?.isRegistered && selectedClinic.doctors.length > 0 && (
                    <div>
                      <div className="mb-4 pb-3 border-b border-border">
                        <h3 className="text-lg font-semibold text-muted-foreground uppercase tracking-wide">
                          Available Doctors ({selectedClinic.doctors.length})
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">Select a doctor to join their queue</p>
                      </div>
                      <div className="space-y-2">
                        {selectedClinic.doctors.map((doctor) => (
                          <div
                            key={doctor.id}
                            className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-muted/30 hover:bg-muted/60 border border-transparent hover:border-border rounded-lg transition-all group gap-4 sm:gap-0"
                          >
                            <div className="flex items-center space-x-4">
                              <div className="w-10 h-10 bg-teal-100/50 dark:bg-teal-900/30 rounded-full flex items-center justify-center group-hover:bg-teal-100 dark:group-hover:bg-teal-900/50 transition-colors">
                                <Stethoscope className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                              </div>
                              <div>
                                <h4 className="font-medium text-sm">{doctor.name}</h4>
                                <p className="text-xs text-muted-foreground">{doctor.specialization}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  <Clock className="w-3 h-3 inline mr-1" />
                                  {doctor.availability}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-4 justify-between sm:justify-end w-full sm:w-auto border-t sm:border-t-0 pt-3 sm:pt-0 border-border">
                              <div className="text-left sm:text-right">
                                <p className="text-xs text-muted-foreground">In Queue</p>
                                <p className="text-sm font-semibold">{doctor.queueCount} patients</p>
                              </div>
                              <Button
                                size="sm"
                                className="bg-teal-600 hover:bg-teal-700 text-white whitespace-nowrap"
                                onClick={() => {
                                  setSelectedDate(getLocalYmd());
                                  setSelectedSlotId(null);
                                  setSelectedDoctorForBooking(doctor);
                                }}
                              >
                                Book Slots
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
