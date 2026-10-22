import type { OperatingHours } from "@/types/clinic";
import { getClinicOpenStatus } from "@/utils/clinicHours";

const mondayHours: OperatingHours[] = [
  {
    day: "Monday",
    open: "09:00",
    close: "17:00",
    isClosed: false,
  },
];

describe("getClinicOpenStatus", () => {
  it("marks the clinic open at its opening time", () => {
    expect(
      getClinicOpenStatus(mondayHours, new Date(2025, 0, 6, 9, 0))
    ).toEqual({ isOpen: true, label: "Open · Closes 17:00" });
  });

  it("marks the clinic closed at its closing time", () => {
    expect(
      getClinicOpenStatus(mondayHours, new Date(2025, 0, 6, 17, 0))
    ).toEqual({ isOpen: false, label: "Closed now" });
  });

  it("does not infer closed status when today's hours are missing", () => {
    expect(
      getClinicOpenStatus([], new Date(2025, 0, 6, 10, 0))
    ).toEqual({ isOpen: false, label: "Hours not available" });
  });

  it("reports a scheduled closed day", () => {
    expect(
      getClinicOpenStatus(
        [{ ...mondayHours[0], isClosed: true }],
        new Date(2025, 0, 6, 10, 0)
      )
    ).toEqual({ isOpen: false, label: "Closed today" });
  });
});
