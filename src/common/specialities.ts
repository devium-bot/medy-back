export const SPECIALITIES = ['medecine', 'pharmacie', 'dentaire'] as const;

export type Speciality = (typeof SPECIALITIES)[number];
