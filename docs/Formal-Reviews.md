# Formal reviews

## Delivered workflow

Use **Formal reviews → Start review** below the assumption portfolio. The first review establishes a baseline. Later reviews compare the captured saved portfolio with the most recent published review: new assumptions, wording, criticality/evidence, next step, help needed, and new insight/change records. Expand a row for details, including from/to scores and source links. Unassessed scores remain distinct from zero.

The review has a default date-based title and optional notes. **Refresh saved state** reloads the portfolio and baseline without clearing the title or notes. **Publish review** preserves exactly the displayed capture, its promises and insights, notes, publisher email/UID, and server publication time. Published reviews can be reopened but cannot be edited or deleted. Ordinary project editing continues.

Only saved project data is included. Draft review notes live in the current browser component: canceling, reloading, or switching projects discards them. Opening a review does not create a Firestore draft or freeze project work. No schedule or minimum interval is imposed, so reviews can happen every two days or whenever useful.

## Persistence and security

Each publication is one atomic document at `projects/{projectId}/reviews/{reviewId}`, with `schemaVersion: 1`, `previousReviewId`, `capturedAt` (client milliseconds), `assumptions`, `promises`, `title`, `notes`, and server-attributed publication fields. Assumption IDs and numeric scores support future movement comparisons; insight IDs distinguish additions without depending on client clock boundaries. Each snapshot copies insight content and its original author/time.

Rules require verified active project membership for all reads and publication, validate the envelope and publisher identity/server time, and forbid update/delete. A referenced baseline must exist in the same project. Snapshot content is submitted by the publishing member; rules do not independently certify every nested value against live source documents. This is a member-published record, not a server-certified audit of the entire database. Administrative SDK access remains outside client rules.

Capturing uses multiple reads, not a database-wide transaction. Concurrent edits during capture can require a refresh; publication does not silently recapture or overwrite what the reviewer inspected. Another member publishing meanwhile does not change this draft's explicit baseline. Server publication order determines the next newly opened review's baseline. The single-document format uses an 800 KB client payload guard to leave room below Firestore's 1 MiB limit; publication fails visibly with the draft retained if too large. Partitioned snapshots are future work if real portfolios outgrow this format.

A stable draft ID makes publication retries idempotent. If the commit succeeds but reloading the list fails, the UI reports that the review was published and offers a reload rather than suggesting a second publication.

## Deployment

Deploy both Hosting and Firestore rules with `npm.cmd run deploy:development`. Deploying only Hosting will leave reviews blocked by the previous rules. No dependency or Firebase configuration changes are required.

## Manual acceptance

1. Open an existing project; start a review and verify the first-review message, promises, current scores, and expanded next step/help/insights. Cancel once and confirm no publication exists.
2. Start again, enter notes, and publish. Reopen the publication and check attribution and content.
3. Change a score, add an insight without changing a score, change a next step, and add an unassessed assumption. Start another review and check old/new values, the insight-only addition, and the new assumption.
4. Publish again and reopen both snapshots. The first remains unchanged; the second compares with the first.
5. Change saved work while a review is open in another tab. Confirm the displayed capture remains unchanged until refreshed; refreshing retains the review title and notes.
6. Switch projects and confirm neither review drafts nor publications leak between projects. A nonmember must not read or publish reviews.

Automated coverage includes comparison semantics, draft retention/retry, refresh/cancel, member-only access, publisher validation, immutable publications, baseline isolation, and service-level idempotent publication against the Firestore emulator.

## Remaining scope

Merge/split/discard lineage is unavailable until the assumption lifecycle slice exists. A missing assumption can be labeled “No longer present,” but reviews do not invent a removal reason. Invitations/membership administration, guided setup, candidate lifecycle, notifications, and pilot acceptance remain separate backlog work. The insight design continues to defer multi-assumption links and supersession.
