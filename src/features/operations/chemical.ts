export const calculateChemicalDose = (referenceAmount: number, actualTankLitres: number, referenceWaterLitres = 200): number | null => {
  if (![referenceAmount, actualTankLitres, referenceWaterLitres].every(Number.isFinite) || referenceAmount < 0 || actualTankLitres < 0 || referenceWaterLitres <= 0) return null;
  return referenceAmount * actualTankLitres / referenceWaterLitres;
};
