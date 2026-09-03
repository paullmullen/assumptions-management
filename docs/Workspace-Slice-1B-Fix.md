# Slice 1B follow-up — chart sizing

The user clarified that selecting an existing assumption should open its entire form, including New insights and history. That full form is retained.

Opening the drawer had removed the workspace's 1440 px width limit and forced the chart into a single full-width column. On wide screens this substantially enlarged the chart and pushed the assumption list down.

The correction retains the workspace width limit while reserving drawer space, retains the chart/list column layout, and caps the chart at 720 px in both open and closed states. At narrower widths it can shrink to fit; opening the drawer does not enlarge it. Existing phone layouts keep their chart scrolling behavior.

No form, save, service, security-rule, dependency, or data changes are included. The full Slice 1B source and its earlier changes are included in this ZIP. A deployment upgrading from before 1B still needs its accompanying Firestore rules; updating from 1B needs only the rebuilt Hosting assets.

Validation: CSS formatting and production build checked. Browser visual acceptance remains pending because the browser service could not access the local preview in this environment. Verify chart/list size before and after opening the drawer at the user's screen width.
