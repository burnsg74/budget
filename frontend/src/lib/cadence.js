// How a scheduled account repeats. Stored on the account; labels are for the UI.
export const CADENCES = ["day", "biweekly", "month"];

export const CADENCE_LABELS = {
  day: "Day of month",
  biweekly: "Every 2 weeks",
  month: "Once a month",
};

export const CADENCE_OPTIONS = CADENCES.map((value) => ({ value, label: CADENCE_LABELS[value] }));
