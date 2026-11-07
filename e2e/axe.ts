import AxeBuilder from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'

/** axe-core checks for the accessibility specs (desktop and phone). */

// The tuplet icon draws a "3" as SVG text, which axe counts as visible text the button's
// name should contain; it is part of the picture, the button's name is "Tuplet".
const EXCLUDED = ['#tuplet']

export async function expectNoAxeViolations(page: Page, include?: string): Promise<void> {
  let builder = new AxeBuilder({ page })
  for (const selector of EXCLUDED) builder = builder.exclude(selector)
  if (include) builder = builder.include(include)
  const { violations } = await builder.analyze()
  const summary = violations.map(
    (violation) =>
      `${violation.impact} ${violation.id}: ${violation.help}\n` +
      violation.nodes
        .slice(0, 5)
        .map((node) => `    ${node.target.join(' ')}: ${node.failureSummary?.split('\n')[1]?.trim() ?? ''}`)
        .join('\n'),
  )
  expect(summary).toEqual([])
}
