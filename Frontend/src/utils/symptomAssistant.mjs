export const isSymptomBookingAllowed = (result) => Boolean(
  result?.booking_allowed && result?.urgency_level !== 'EMERGENCY'
);
