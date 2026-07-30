import type { MaterialInput, MaterialLibraryItem } from './types';

export type MaterialCatalogMode = 'library' | 'materialDetail' | 'materialCreate' | 'materialEdit';

export type ActivityMaterialReturnIntent = {
  source: 'activity';
  usageKey: string;
};

export type MaterialLibraryTypeFilter = 'all' | 'chemical' | 'fertilizer' | 'other';

export const filterMaterialLibraryItems = (
  materials: MaterialLibraryItem[],
  input: { archived: boolean; query: string; type: MaterialLibraryTypeFilter },
): MaterialLibraryItem[] => {
  const query = input.query.trim().toLocaleLowerCase('th-TH');
  return materials.filter((material) => {
    if (Boolean(material.archivedAt) !== input.archived) return false;
    const typeMatches = input.type === 'all'
      || (input.type === 'chemical' && (material.type === 'fungicide' || material.type === 'insecticide'))
      || (input.type === 'fertilizer' && material.type === 'fertilizer')
      || (input.type === 'other' && !['fungicide', 'insecticide', 'fertilizer'].includes(material.type));
    if (!typeMatches) return false;
    if (!query) return true;
    return [material.name, material.commonName, material.brandName, material.notes]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.toLocaleLowerCase('th-TH').includes(query));
  });
};

export const emptyMaterialDraft = (): MaterialInput => ({
  id: '',
  name: '',
  type: 'fungicide',
  unit: 'cc',
  referenceUnit: 'cc',
  referenceWaterLitres: 200,
});

/** Hydrates every editable catalog fact so an untouched edit cannot erase optional detail. */
export const materialDraftFromLibrary = (material: MaterialLibraryItem): MaterialInput => ({
  id: material.id,
  name: material.name,
  type: material.type as MaterialInput['type'],
  unit: material.unit,
  defaultRatePerTank: material.defaultRatePerTank,
  notes: material.notes,
  commonName: material.commonName,
  brandName: material.brandName,
  chemicalGroup: material.chemicalGroup,
  usageLabel: material.usageLabel,
  referenceAmount: material.referenceAmount,
  referenceUnit: material.referenceUnit,
  referenceWaterLitres: material.referenceWaterLitres ?? 200,
});

export const validateMaterialCatalogDraft = (draft: MaterialInput): string | null => {
  if (!draft.name.trim()) return 'กรุณาระบุชื่อวัสดุหรือชื่อสามัญ';
  if (!(draft.referenceUnit ?? draft.unit).trim()) return 'กรุณาระบุหน่วยของวัสดุ';
  return null;
};
