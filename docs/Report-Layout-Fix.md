# Project brief: complete legend and overflow guidance

The one-page brief has a larger chart above a two-column numbered legend on the left, and selected details on the right. The optional review comparison occupies its own row. The chart still plots every assessed assumption, regardless of discussion selection. All source assumptions appear in source-number order in the legend; a star marks discussion selections and unassessed entries say “Not assessed.” Up to four assumptions receive detailed discussion entries.

Report-only wording excerpts are available for every assumption, including unselected legend entries. Excerpts are labeled and never change source data. Overflow guidance identifies the affected area: chart or legend overflow no longer tells users to select fewer discussion items. Printing remains blocked when content does not fit; names are not silently removed or cropped. Very large portfolios or long wording can still exceed one page.

Validation: application regression tests, lint, formatting and production build. Automated DOM tests check complete legends with zero selections, four selection markers, unselected excerpts, and area-specific warning advice. Physical browser/print acceptance remains pending: the browser service previously blocked the local preview. Use tests/browser/report-preview.html to check zero/four selections, comparison on/off, long legends, narrow viewport and Letter landscape print preview.

Deployment from the invitations/movement release requires Hosting only: `firebase deploy --only hosting`. No Firestore rules or data migration changes.

## Follow-up: larger graph and header correction

The portfolio now occupies 52% of the main area, with a 2.9-inch-high graph and the complete legend below it in two columns. Discussion details occupy the right side. The header sizes to its content instead of the previous ¾-inch limit. Individual project-name and source/review-title checks give instructions naming the exact excerpt field. The title allows two lines; unusually long titles or legends still require report-only excerpts to preserve the single-page format.

The focused report tests, lint, formatting and build were rerun. Browser and physical print acceptance remain pending. Check the six-assumption case with zero and three/four selections, with comparison enabled, plus long project/review names. Hosting-only deployment still applies.

## Formatting cleanup

Removed the footer, chart direction explanation, and team-selected count. The main area now uses 60% for the chart/legend and 40% for discussion details, with a 3.15-inch-high graph. Names continue to wrap; no ellipsis was needed in this pass. Individual excerpt labels remain beside edited wording. Removing the footer also returns its reserved height and gap to the main content. Hosting only; browser/print acceptance remains pending.

## Widescreen brief (current)

The brief is now 16:9 (13⅓ × 7½ inches), with a 3.5-inch-high graph. The review-change summary, its checkbox and per-item comparison labels are removed from the brief. The brief no longer fetches comparison history. Current saved state and saved-review source selection remain available, with scores from the selected source.

Save as PDF using the widescreen page size. To print on Letter, choose landscape and scale to fit the paper, with browser headers/footers disabled. Browser/physical-print acceptance remains pending. The preview fixture now tests zero/four selections and long legends/promises without the removed comparison control.

Backlog: show movement on the brief’s graph in a separate slice. Existing interactive portfolio movement is unaffected. Deploy Hosting only.

## Legend cleanup

Removed the horizontal rule above the legend, “All assumptions” heading, star explanation, and active/assessed/unassessed counts above the chart. The complete numbered legend, selected-entry markers, and individual unassessed labels remain. Hosting-only update.

## Long promises

Promise text in the brief is limited to two lines with a visible ellipsis. Full text remains saved and is available on hover in the screen preview. All three promise entry fields suggest one short sentence without adding a new input limit. This intentionally replaces the earlier no-truncation behavior for promises only. Browser/print visual acceptance remains pending. Hosting only.

## Movement in the brief

The optional “Show movement since last review” control adds prior-position outlines and net arrows using the same movement logic as the working portfolio. It applies to every plotted assumption, independent of the discussion selection. Current reports use the latest saved review; saved-review reports use an earlier published and captured review. A baseline newer than the loaded current report is suppressed with refresh guidance. No previous review means no arrows. New or unassessed assumptions have no invented prior positions.

The capture date and a compact outline/arrow key appear on the brief when enabled and are retained in the print snapshot. The removed aggregate change summary stays removed. No additional history reads or Firestore rules changes are needed. Hosting only. Visual/print acceptance remains pending; the preview fixture includes a movement toggle.
