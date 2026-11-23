"use client";

import { useCallback, useState } from "react";
import { Clinic } from "@/types/clinic";

export const MAX_COMPARE_CLINICS = 3;

export interface ClinicComparisonState {
  selectedClinics: Clinic[];
  isSelected: (clinicId: string) => boolean;
  isFull: boolean;
  canAdd: boolean;
  addClinic: (clinic: Clinic) => void;
  removeClinic: (clinicId: string) => void;
  toggleClinic: (clinic: Clinic) => void;
  clearComparison: () => void;
}

export function useClinicComparison(): ClinicComparisonState {
  const [selectedClinics, setSelectedClinics] = useState<Clinic[]>([]);

  const isSelected = useCallback(
    (clinicId: string) =>
      selectedClinics.some((clinic) => clinic.id === clinicId),
    [selectedClinics]
  );

  const addClinic = useCallback((clinic: Clinic) => {
    setSelectedClinics((current) => {
      if (current.some((c) => c.id === clinic.id)) return current;
      if (current.length >= MAX_COMPARE_CLINICS) return current;
      return [...current, clinic];
    });
  }, []);

  const removeClinic = useCallback((clinicId: string) => {
    setSelectedClinics((current) =>
      current.filter((clinic) => clinic.id !== clinicId)
    );
  }, []);

  const toggleClinic = useCallback((clinic: Clinic) => {
    setSelectedClinics((current) => {
      const exists = current.some((c) => c.id === clinic.id);
      if (exists) {
        return current.filter((c) => c.id !== clinic.id);
      }
      if (current.length >= MAX_COMPARE_CLINICS) return current;
      return [...current, clinic];
    });
  }, []);

  const clearComparison = useCallback(() => {
    setSelectedClinics([]);
  }, []);

  return {
    selectedClinics,
    isSelected,
    isFull: selectedClinics.length >= MAX_COMPARE_CLINICS,
    canAdd: selectedClinics.length < MAX_COMPARE_CLINICS,
    addClinic,
    removeClinic,
    toggleClinic,
    clearComparison,
  };
}
