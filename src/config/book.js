/**
 * "Classic Book" geometry and layout weights.
 *
 * The PDF composer paginates *itself* — it decides which projects land on
 * which physical page — instead of letting the browser break the flow and then
 * trying to guess the page numbers afterwards. That is the only way a table of
 * contents can quote a page number it has not reached yet.
 *
 * Because the decision is ours, the numbers below must describe reality:
 * `contentHeightMm` has to be *at least* as tall as the sum of the parts a
 * page can hold, or an entry would spill onto the next physical sheet while
 * still claiming the page number it was assigned. They are therefore kept
 * deliberately conservative (a few millimetres of slack) and exported, so the
 * constants are unit-testable and tunable in one place.
 *
 * @module config/book
 */

/**
 * A4 sheet, expressed once so `styles/book.css`, the `@page` rule and the
 * pagination maths can never drift apart.
 */
export const BOOK_PAPER = Object.freeze({
  format: 'A4',
  widthMm: 210,
  heightMm: 297,
  marginTopMm: 22,
  marginBottomMm: 20,
  marginXMm: 18,
  /** 210 − 2 × 18 */
  contentWidthMm: 174,
  /**
   * 297 − 22 − 20 = 255 mm is printable. We lay out 248 mm and leave the rest
   * as slack for a description that renders a line taller than predicted
   * (long unbreakable words, a fallback font with a taller line box, …).
   *
   * Tuned together with `BOOK_WEIGHTS`: a project with a ~600-character
   * description still shares a sheet with a neighbour, two wordy ones do not.
   */
  contentHeightMm: 248,
});

/**
 * The running header/footer are absolutely positioned *outside* the page box,
 * into the sheet margin. Offsets are negative distances from the content box.
 */
export const BOOK_RUNNERS = Object.freeze({
  /** 22 mm top margin − 14 mm → the header starts 8 mm below the paper edge. */
  headerOffsetMm: -14,
  /** 20 mm bottom margin − 14 mm → the footer ends 6 mm above the paper edge. */
  footerOffsetMm: -14,
});

/**
 * Vertical cost of every moving part of a page, in millimetres.
 *
 * These mirror `styles/book.css` exactly: if the stylesheet grows a line, this
 * table has to grow with it. `tests/paginate.test.js` pins the relationships
 * that matter (short entries pair up, long ones do not).
 */
export const BOOK_WEIGHTS = Object.freeze({
  /** Entry padding + hairline rules + breathing room. */
  entryChromeMm: 16,
  /** "Chapter 01" kicker, the project title and the status/language row. */
  entryHeadingMm: 17,
  /** Stars · forks · last updated · licence. */
  entryMetaMm: 10,
  /** One wrapped row of `#topic` chips. */
  entryTopicsMm: 8,
  /** One link row (label + the URL in mono). */
  entryLinkMm: 12,
  /** Separator between two entries sharing a page. */
  entrySeparatorMm: 9,
  /** Body line height at 10.5 pt / 1.6. */
  descriptionLineMm: 6,
  /** Margin above/below the description paragraph. */
  descriptionPadMm: 4,
  /** Characters per body line at 174 mm — drives "1 or 2 projects per page". */
  descriptionCharsPerLine: 88,

  /** "Table of contents" title + rule, first TOC page only. */
  tocHeadingMm: 26,
  /** Smaller continuation title on every further TOC page. */
  tocContinueMm: 14,
  /** Status group heading ("Live projects"). */
  tocGroupHeadMm: 11,
  /** Repeated group heading on a continuation page ("… (continued)"). */
  tocGroupContMm: 9,
  /** One TOC line. */
  tocEntryMm: 8.5,
  /** Space after a group. */
  tocGroupGapMm: 5,
  /** Hard cap per TOC page, so a pathological payload cannot produce nonsense. */
  tocMaxEntriesPerPage: 24,
});

/** Book copy limits — the printed page has finite room. */
export const BOOK_LIMITS = Object.freeze({
  /**
   * Longest description that goes onto paper, with an ellipsis.
   *
   * Sized so the "mixed layout" in the brief is reachable: at ~88 characters
   * per line, everything up to roughly 850 characters still shares a sheet
   * with a neighbour, and anything longer earns a page of its own. Clamping
   * lower would make "1 project per page" dead code.
   */
  descriptionChars: 1200,
  topics: 6,
  links: 3,
  /**
   * The catalogue is a *mixed* layout: two short projects share a sheet, a
   * wordy one gets the page to itself. Hard cap of 2 so the page never turns
   * into a list — the spec asks for 1 to 2, never 3.
   */
  projectsPerPage: 2,
});

/** The subtitle is fixed copy, not user input, but it is translated. */
export const BOOK_SUBTITLE_KEY = 'book.cover.subtitle';

/** Default file name stem for the generated PDF (`document.title`). */
export const BOOK_FILENAME_PREFIX = 'gitbinder';
