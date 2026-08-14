/** Callback do R3F `invalidate` — registrado por `DemandFrameLoop` dentro do Canvas. */
let invalidateFn: (() => void) | null = null;

/** Tokens de demanda pontual (intro, fantasma caindo, partículas, câmera GSAP, etc.). */
const demandTokens = new Set<string>();

export function setFrameInvalidate(fn: (() => void) | null): void {
  invalidateFn = fn;
}

/** Agenda um quadro de renderização. */
export function requestFrame(): void {
  invalidateFn?.();
}

export function acquireFrameDemand(token: string): void {
  demandTokens.add(token);
  requestFrame();
}

export function releaseFrameDemand(token: string): void {
  demandTokens.delete(token);
}

export function hasExternalFrameDemand(): boolean {
  return demandTokens.size > 0;
}
