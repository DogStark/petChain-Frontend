export interface PetAge {
  years: number;
  months: number;
  totalMonths: number;
  isBirthday: boolean;
  display: string;
}

/**
 * Calculates a pet's age from date of birth, including years and months.
 * Returns null for invalid dates.
 */
export function calculatePetAge(dateOfBirth: string, now: Date = new Date()): PetAge | null {
  if (!dateOfBirth) return null;
  const birth = new Date(dateOfBirth);
  if (Number.isNaN(birth.getTime())) return null;
  if (birth > now) return null;

  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();

  if (now.getDate() < birth.getDate()) {
    months -= 1;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const totalMonths = years * 12 + months;

  const isBirthday =
    now.getMonth() === birth.getMonth() && now.getDate() === birth.getDate();

  let display: string;
  if (years === 0) {
    display = totalMonths === 1 ? '1 month old' : `${totalMonths} months old`;
  } else if (months === 0) {
    display = years === 1 ? '1 year old' : `${years} years old`;
  } else {
    const yearPart = years === 1 ? '1 year' : `${years} years`;
    const monthPart = months === 1 ? '1 month' : `${months} months`;
    display = `${yearPart}, ${monthPart} old`;
  }

  return { years, months, totalMonths, isBirthday, display };
}
