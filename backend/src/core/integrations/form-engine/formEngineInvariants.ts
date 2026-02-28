export interface FormEngineInvariantRecord {
  code: string;
  isActive: boolean;
  isDefault: boolean;
}

export const assertFormEngineInvariantsInMemory = (engines: FormEngineInvariantRecord[]): void => {
  const active = engines.filter((engine) => engine.isActive);
  if (active.length === 0) {
    throw new Error('At least one active form engine is required');
  }

  const defaults = engines.filter((engine) => engine.isDefault);
  if (defaults.length !== 1) {
    throw new Error('Exactly one default form engine is required');
  }

  if (!defaults[0].isActive) {
    throw new Error('Default form engine must be active');
  }
};
