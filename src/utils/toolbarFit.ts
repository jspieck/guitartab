/**
 * Which toolbar groups to fold into menus so a bar fits its width. Pure; the toolbar measures
 * the groups (`composables/useToolbarFit.ts`) and renders a folded group as a menu entry.
 */
export interface FoldableGroup {
  id: string
  /** Width of the group as buttons, including its share of gaps and separators. */
  width: number
  /** Width left behind when folded (0 when it moves into a shared menu). */
  foldedWidth?: number
  /** The shared menu the group folds into; the menu's button appears once any group is in it. */
  menu?: string
}

/**
 * Folds groups in `foldOrder` (first entry folds first) until the bar fits `available`.
 * Groups not in `foldOrder` never fold. Returns the folded ids; when even everything folded
 * doesn't fit, all of `foldOrder` is folded and the bar clips what is left.
 */
export function fitToolbarGroups(
  groups: readonly FoldableGroup[],
  available: number,
  foldOrder: readonly string[],
  menuWidths: Readonly<Record<string, number>> = {},
): Set<string> {
  const folded = new Set<string>()
  const required = () => {
    const openMenus = new Set<string>()
    let width = 0
    for (const group of groups) {
      if (folded.has(group.id)) {
        width += group.foldedWidth ?? 0
        if (group.menu != null) openMenus.add(group.menu)
      } else {
        width += group.width
      }
    }
    for (const menu of openMenus) width += menuWidths[menu] ?? 0
    return width
  }

  for (const id of foldOrder) {
    if (required() <= available) break
    if (groups.some((group) => group.id === id)) folded.add(id)
  }
  return folded
}
