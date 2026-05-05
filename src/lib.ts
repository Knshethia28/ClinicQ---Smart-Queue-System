/**
 * ClinicQ Library - All constants, types, helpers, and utilities
 * Consolidated from utils/constants.ts, utils/types.ts, utils/helpers.ts, and utils/dom.js
 */

// ============================================================================
// CONSTANTS
// ============================================================================

export const APP_CONFIG = {
  name: 'ClinicQ',
  version: '1.0.0',
  lastUpdated: 'January 2025',
  description: 'Smart Queue Management System for Clinics'
};

export const TIMING = {
  patientAutoAddInterval: 120000, // 2 minutes
  clockUpdateInterval: 60000, // 1 minute
  defaultWaitTime: 10, // minutes
  toastDuration: 4000 // milliseconds
};

export const TOKEN_PREFIXES = {
  appointment: 'A',
  walkIn: 'W'
};

export const USER_ROLES = {
  doctor: 'doctor',
  patient: 'patient'
};

export const PATIENT_STATUS = {
  waiting: 'waiting',
  current: 'current',
  completed: 'completed'
} as const;

export const DEMO_PATIENT_NAMES = [
  'Jessica Brown',
  'David Lee',
  'Amanda White',
  'Thomas Garcia',
  'Lisa Anderson',
  'James Miller',
  'Maria Rodriguez',
  'Chris Taylor'
];

export const DEMO_APPOINTMENTS = [
  { time: '09:00 AM', patient: 'John Smith', type: 'Regular Checkup' },
  { time: '10:30 AM', patient: 'Mary Johnson', type: 'Follow-up' },
  { time: '11:00 AM', patient: 'Bob Williams', type: 'Consultation' },
  { time: '02:00 PM', patient: 'Alice Brown', type: 'Regular Checkup' },
  { time: '03:30 PM', patient: 'Tom Davis', type: 'Follow-up' },
];

export const CLINIC_SPECIALTIES = [
  'General Practice',
  'Pediatrics',
  'Cardiology',
  'Dermatology',
  'Orthopedics',
  'ENT',
  'Ophthalmology',
  'Dental'
];

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface User {
  username: string;
  role: string;
}

export interface Patient {
  id: string;
  name: string;
  token: string;
  estimatedWait: number;
  status: 'waiting' | 'current' | 'completed';
  checkedIn: string;
  phone: string;
}

export interface Appointment {
  time: string;
  patient: string;
  type: string;
}

export interface Clinic {
  id: string;
  name: string;
  address: string;
  distance: number;
  travelTime: number;
  specialty: string;
  waitingPatients: number;
  status: 'open' | 'busy' | 'closed';
  rating: number;
  nextAvailable: string;
  isFavorite?: boolean;
}

export interface QueueStatus {
  token: string;
  position: number;
  estimatedWait: number;
  checkedInTime: string;
  clinic: string;
  status: 'waiting' | 'current' | 'completed';
}

export type TabType = 'home' | 'patients' | 'appointments' | 'settings';
export type PatientTabType = 'home' | 'queue' | 'clinics' | 'settings';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate a random appointment token
 */
export function generateAppointmentToken(count: number): string {
  return `${TOKEN_PREFIXES.appointment}${String(count).padStart(3, '0')}`;
}

/**
 * Generate a random walk-in token
 */
export function generateWalkInToken(): string {
  return `${TOKEN_PREFIXES.walkIn}${String(Math.floor(Math.random() * 999) + 1).padStart(3, '0')}`;
}

/**
 * Generate a random phone number
 */
export function generatePhoneNumber(): string {
  return `+1-555-${Math.floor(Math.random() * 9999).toString().padStart(4, '0')}`;
}

/**
 * Get current time formatted as HH:MM AM/PM
 */
export function getCurrentTimeFormatted(): string {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Get current date formatted
 */
export function getCurrentDateFormatted(): string {
  return new Date().toLocaleDateString();
}

/**
 * Get initials from a name
 */
export function getInitials(name: string): string {
  return name.split(' ').map(n => n.charAt(0)).join('');
}

/**
 * Get a random patient name
 */
export function getRandomPatientName(): string {
  return DEMO_PATIENT_NAMES[Math.floor(Math.random() * DEMO_PATIENT_NAMES.length)];
}

/**
 * Calculate distance from coordinates (simplified)
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return Math.round(distance * 10) / 10; // Round to 1 decimal place
}

/**
 * Calculate estimated travel time based on distance
 */
export function calculateTravelTime(distance: number): number {
  // Assume average speed of 30 km/h in city
  return Math.ceil((distance / 30) * 60); // Convert to minutes
}

/**
 * Update wait times for patients in queue
 */
export function updateWaitTimes(patients: Patient[], decreaseAmount: number = TIMING.defaultWaitTime): Patient[] {
  return patients.map(patient => {
    if (patient.status === 'waiting') {
      return {
        ...patient,
        estimatedWait: Math.max(0, patient.estimatedWait - decreaseAmount)
      };
    }
    return patient;
  });
}

/**
 * Sort clinics by distance
 */
export function sortByDistance<T extends { distance: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.distance - b.distance);
}

/**
 * Sort clinics by wait time
 */
export function sortByWaitTime<T extends { waitingPatients: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.waitingPatients - b.waitingPatients);
}

/**
 * Filter clinics by specialty
 */
export function filterBySpecialty<T extends { specialty: string }>(
  items: T[],
  specialty: string
): T[] {
  if (specialty === 'All Specialties') return items;
  return items.filter(item => item.specialty === specialty);
}

/**
 * Format time difference in human readable format
 */
export function formatTimeDifference(minutes: number): string {
  if (minutes < 1) return 'Now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

/**
 * Validate phone number format
 */
export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/;
  return phoneRegex.test(phone);
}

/**
 * Create a new patient object
 */
export function createPatient(
  name: string,
  token: string,
  phone: string = '',
  status: Patient['status'] = 'waiting',
  estimatedWait: number = TIMING.defaultWaitTime
): Patient {
  return {
    id: Date.now().toString(),
    name,
    token,
    estimatedWait,
    status,
    checkedIn: getCurrentTimeFormatted(),
    phone: phone || 'N/A'
  };
}

// ============================================================================
// DOM & BROWSER UTILITIES
// ============================================================================

/**
 * Apply dark mode to document
 */
export function applyDarkMode(isDark: boolean): void {
  if (isDark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

/**
 * Get saved dark mode preference from localStorage
 */
export function getDarkModePreference(): boolean {
  try {
    const saved = localStorage.getItem('clinicq-dark-mode');
    return saved === 'true';
  } catch (error) {
    console.error('Failed to get dark mode preference:', error);
    return false;
  }
}

/**
 * Save dark mode preference to localStorage
 */
export function saveDarkModePreference(isDark: boolean): void {
  try {
    localStorage.setItem('clinicq-dark-mode', isDark.toString());
  } catch (error) {
    console.error('Failed to save dark mode preference:', error);
  }
}

/**
 * Get user from localStorage
 */
export function getSavedUser(): any {
  try {
    const saved = localStorage.getItem('clinicq-user');
    return saved ? JSON.parse(saved) : null;
  } catch (error) {
    console.error('Failed to get saved user:', error);
    return null;
  }
}

/**
 * Save user to localStorage
 */
export function saveUser(user: any): void {
  try {
    localStorage.setItem('clinicq-user', JSON.stringify(user));
  } catch (error) {
    console.error('Failed to save user:', error);
  }
}

/**
 * Clear user from localStorage
 */
export function clearUser(): void {
  try {
    localStorage.removeItem('clinicq-user');
  } catch (error) {
    console.error('Failed to clear user:', error);
  }
}

/**
 * Get favorites from localStorage
 */
export function getFavorites(): string[] {
  try {
    const saved = localStorage.getItem('clinicq-favorites');
    return saved ? JSON.parse(saved) : [];
  } catch (error) {
    console.error('Failed to get favorites:', error);
    return [];
  }
}

/**
 * Save favorites to localStorage
 */
export function saveFavorites(favorites: string[]): void {
  try {
    localStorage.setItem('clinicq-favorites', JSON.stringify(favorites));
  } catch (error) {
    console.error('Failed to save favorites:', error);
  }
}

/**
 * Check if device supports geolocation
 */
export function supportsGeolocation(): boolean {
  return 'geolocation' in navigator;
}

/**
 * Get current position using Geolocation API
 */
export function getCurrentPosition(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    if (!supportsGeolocation()) {
      reject(new Error('Geolocation is not supported'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
      },
      (error) => {
        reject(error);
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      }
    );
  });
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch (error) {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
    } catch (err) {
      console.error('Failed to copy:', err);
    }
    document.body.removeChild(textArea);
  }
}

/**
 * Request notification permission
 */
export async function requestNotificationPermission(): Promise<string> {
  if (!('Notification' in window)) {
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission;
  }

  return Notification.permission;
}

/**
 * Show browser notification
 */
export function showNotification(title: string, options: NotificationOptions = {}): void {
  if (!('Notification' in window)) {
    console.warn('This browser does not support notifications');
    return;
  }

  if (Notification.permission === 'granted') {
    new Notification(title, {
      icon: '/icon.png',
      badge: '/badge.png',
      ...options
    });
  }
}

/**
 * Scroll to top of page smoothly
 */
export function scrollToTop(): void {
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}

/**
 * Scroll element into view
 */
export function scrollIntoView(selector: string): void {
  const element = document.querySelector(selector);
  if (element) {
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });
  }
}

/**
 * Detect if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Detect if user prefers dark mode (system preference)
 */
export function prefersColorSchemeDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Vibrate device if supported
 */
export function vibrate(pattern: number | number[] = 200): void {
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
}

/**
 * Play notification sound
 */
export function playNotificationSound(soundUrl: string = '/notification.mp3'): void {
  try {
    const audio = new Audio(soundUrl);
    audio.volume = 0.5;
    audio.play().catch(err => {
      console.warn('Could not play notification sound:', err);
    });
  } catch (error) {
    console.error('Error playing sound:', error);
  }
}

/**
 * Debounce function - delays execution until after wait time
 */
export function debounce<T extends (...args: any[]) => any>(func: T, wait: number = 300): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function - limits execution to once per wait time
 */
export function throttle<T extends (...args: any[]) => any>(func: T, wait: number = 300): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false;
  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, wait);
    }
  };
}
