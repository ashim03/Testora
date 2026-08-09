import { create } from "zustand";

export interface Branding {
  id: string;
  userId: string;
  name: string;
  tagline: string;
  logoUrl?: string | null;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  social: Record<string, string>;
  isActive: boolean;
}

interface BrandingState {
  branding: Branding | null;
  loaded: boolean;
  setBranding: (b: Branding | null) => void;
}

export const useBrandingStore = create<BrandingState>((set) => ({
  branding: null,
  loaded: false,
  setBranding: (branding) => set({ branding, loaded: true }),
}));