import type { OperatingHours } from "@/types/clinic";

export interface ClinicOpenStatus {
  isOpen: boolean;
  label: string;
}

export function getClinicOpenStatus(
  hours: OperatingHours[],
  now = new Date()
): ClinicOpenStatus {
  const days: OperatingHours["day"][] = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const todayHours = hours.find((entry) => entry.day === days[now.getDay()]);

  if (!todayHours) {
    return { isOpen: false, label: "Hours not available" };
  }

  if (todayHours.isClosed) {
    return { isOpen: false, label: "Closed today" };
  }

  const [openH, openM] = todayHours.open.split(":").map(Number);
  const [closeH, closeM] = todayHours.close.split(":").map(Number);
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  if (nowMinutes >= openMinutes && nowMinutes < closeMinutes) {
    return { isOpen: true, label: `Open · Closes ${todayHours.close}` };
  }
  if (nowMinutes < openMinutes) {
    return { isOpen: false, label: `Opens ${todayHours.open}` };
  }
  return { isOpen: false, label: "Closed now" };
}
