// The single frontend declaration of hideable content. Keys match the backend Capability
// enum name for anything enforced server-side; cosmetic entries are frontend-only, so
// adding one is an entry here plus a can() call — no backend change, no regen.
import { type ModuleKey } from './permissions';

export interface CapabilityMeta {
  key: string;
  /** Czech label shown in the role panel. */
  label: string;
  /** Module whose row it nests under; null = cross-application. */
  module: ModuleKey | null;
  /** True when an endpoint enforces it too, so hiding it is a real boundary. */
  guardsData: boolean;
}

// Capability.Money exists on the backend enum as a deliberate future hook, but nothing
// consumes it yet: no endpoint gates on it, and no component calls can('Money'). It is
// deliberately absent from this registry rather than listed with guardsData: false — the
// admin panel would otherwise offer a toggle for a capability that controls nothing.
export const CAPABILITY_REGISTRY = [
  { key: 'Invoicing', label: 'Fakturace', module: 'shipments', guardsData: true },
  { key: 'LoadingBreakdown', label: 'Rozpis nakládky', module: 'shipments', guardsData: false },
] as const satisfies readonly CapabilityMeta[];

export type Capability = (typeof CAPABILITY_REGISTRY)[number]['key'];
