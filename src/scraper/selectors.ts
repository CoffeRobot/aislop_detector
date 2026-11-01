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

/** X's ad-placement wrapper: on ad cells, and on some organic cells too. */
export const PROMOTED_TRACKER = '[data-testid="placementTracking"]'

/** Elements that can carry an explicit promoted/ad label (cheap, every cell). */
export const PROMOTED_LABEL_SOURCES = '[aria-label], [data-testid="socialContext"]'

/** Text elements scanned for an ad label (heavy pass, wrapper-gated). */
export const PROMOTED_TEXT_SOURCES = 'span, [dir="auto"]'

/** Display name, excluded when looking for an explicit ad label. */
export const USER_NAME = '[data-testid="User-Name"]'

/** "Who to follow" widget cells and the user rows they contain. */
export const WHO_TO_FOLLOW =
  'section[data-testid="whoToFollowsWidget"], div[data-testid="UserCell"]'
