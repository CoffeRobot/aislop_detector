// Every X selector string lives in this file and nowhere else (issue-4): X
// markup churns, so a break is fixed here, in one place. Per PLAN.md testing
// doctrine these get no selector tests — proven only by manual end-to-end
// runs in Brave on the real timeline.

/** One timeline item: a post, a widget, or a button row. */
export const TIMELINE_CELL = 'div[data-testid="cellInnerDiv"]'

/** A post article; nested ones are quoted tweets and are never scored alone. */
export const TWEET_ARTICLE = 'article[data-testid="tweet"]'

/** The visible text of a post (or of a quoted tweet nested inside it). */
export const TWEET_TEXT = 'div[data-testid="tweetText"]'

/** Anchor whose href is `/<user>/status/<id>` — the post's own permalink. */
export const STATUS_LINK = 'a[href*="/status/"]'

/** X's ad-placement wrapper around promoted/sponsored timeline cells. */
export const PROMOTED_TRACKER = '[data-testid="placementTracking"]'

/** "Who to follow" widget cells and the user rows they contain. */
export const WHO_TO_FOLLOW =
  'section[data-testid="whoToFollowsWidget"], div[data-testid="UserCell"]'
