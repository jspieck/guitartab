import { reactive } from 'vue'

/**
 * Section practice (Big win 28): the speed each section loop has reached with the speed
 * trainer, by the bar the section starts at. Part of the per-song practice memory
 * (`services/practiceMemory.ts`), so a section picks up where it was left.
 */
export const sectionPracticeState = reactive({
  rates: {} as Record<string, number>,
})

export function sectionRate(startBlock: number): number | undefined {
  return sectionPracticeState.rates[String(startBlock)]
}

export function setSectionRate(startBlock: number, rate: number): void {
  sectionPracticeState.rates[String(startBlock)] = rate
}

/** Replaces the remembered rates (a song was loaded); drops entries that aren't speeds. */
export function setSectionRates(rates: unknown): void {
  const clean: Record<string, number> = {}
  if (rates != null && typeof rates === 'object') {
    for (const [key, value] of Object.entries(rates as Record<string, unknown>)) {
      if (/^\d+$/.test(key) && typeof value === 'number' && Number.isFinite(value) && value > 0)
        clean[key] = value
    }
  }
  sectionPracticeState.rates = clean
}
