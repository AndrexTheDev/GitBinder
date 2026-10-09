/**
 * One card of the repository manager.
 *
 * A card is created once per `slug` and then *updated* in place (see
 * core/list.js). That matters more than it sounds: the description is a live
 * textarea bound to the store on every keystroke, so a naive re-render would
 * eat the caret — and with it the sentence somebody was halfway through.
 *
 * Everything the visitor can change here is an *override* on top of the
 * metadata GitHub gave us. Untouched fields stay `null`, which is why the card
 * also shows where the current value came from ("from GitHub" vs "edited").
 *
 * @module components/RepoCard
 */

import { h, setText } from '../core/dom.js';
import { REPO_STATUSES, TONE_BY_STATUS } from '../config/app.js';
import { DESCRIPTION_MAX_LENGTH, NOTES_MAX_LENGTH } from '../state/schema.js';
import {
  formatCompact,
  formatRelativeTime,
  humanizeRepoName,
  truncate,
} from '../utils/format.js';
import { debounce } from '../utils/timing.js';
import { safeUrl } from '../utils/format.js';
import { icon } from './ui/Icon.js';

/**
 * @param {object} options
 * @param {object} options.repo                 resolved view model (see state/selectors)
 * @param {(key: string, params?: object) => string} options.t
 * @param {() => string} options.locale         active BCP-47 tag, for dates/numbers
 * @param {(slug: string, patch: object) => void} options.onPatch
 * @returns {{ el: HTMLElement, update: (repo: object) => void, destroy: () => void }}
 */
let uid = 0;

export function RepoCard({ repo, t, locale, onPatch }) {
  const slug = repo.slug;
  const cardId = (uid += 1);
  const visibilityId = `repo-include-${cardId}`;
  // The three visible labels below point at their controls with `for`, so
  // clicking the words focuses the field. The controls keep their `aria-label`
  // as well: those name the *repository*, which is what tells one card's
  // "Project status" from the next in a list.
  const statusId = `repo-status-${cardId}`;
  const descriptionId = `repo-description-${cardId}`;
  const notesId = `repo-notes-${cardId}`;

  /* ── Include in book ───────────────────────────────────────────────── */

  const visibility = h('input', {
    id: visibilityId,
    type: 'checkbox',
    class: 'checkbox mt-0.5',
    'aria-label': t('library.row.includeLabel', { name: repo.name }),
    onChange: (event) => onPatch(slug, { visible: event.target.checked }),
  });

  const includeLabel = h(
    'label',
    {
      class: 'cursor-pointer text-2xs font-semibold uppercase tracking-wide text-ink-500 select-none',
      for: visibilityId,
    },
    t('library.row.include'),
  );

  /* ── Title + badges + links ────────────────────────────────────────── */

  const titleLink = h('a', {
    class: 'repo-card__title truncate font-serif text-[15px] font-semibold text-ink-900 underline-offset-2 hover:underline',
    href: repo.url,
    target: '_blank',
    rel: 'noopener noreferrer',
    text: humanizeRepoName(repo.name),
  });

  const badges = h('span', { class: 'flex flex-wrap items-center gap-1' });

  const linkBadges = h('span', { class: 'flex flex-wrap items-center justify-end gap-1' });

  const metaLine = h('div', { class: 'mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-ink-400' });

  /* ── Status ────────────────────────────────────────────────────────── */

  const statusSelect = h(
    'select',
    {
      id: statusId,
      class: 'input py-1 text-xs',
      'aria-label': t('library.row.status.labelFor', { name: repo.name }),
      onChange: (event) => onPatch(slug, { status: event.target.value }),
    },
    REPO_STATUSES.map((status) =>
      h('option', {
        value: status.id,
        selected: status.id === repo.status,
        text: t(`status.${status.id}`),
        'data-i18n': `status.${status.id}`,
      }),
    ),
  );

  /** "auto · has a live homepage" / "set by you" — explains the current value. */
  const statusOrigin = h('span', { class: 'chip !px-1.5 !py-0 text-[10px]' });
  const statusReason = h('p', { class: 'mt-1 text-2xs leading-relaxed text-ink-400' });

  /* ── Short book description ────────────────────────────────────────── */

  // Debounced so the table of contents does not re-sort on every keystroke.
  const commitDescription = debounce(
    (value) => onPatch(slug, { shortDescription: value }),
    220,
  );

  const description = h('textarea', {
    id: descriptionId,
    class: 'input min-h-[4.5rem] resize-y py-1.5 text-xs leading-relaxed',
    rows: '2',
    maxlength: String(DESCRIPTION_MAX_LENGTH),
    'aria-label': t('library.row.description.label'),
    placeholder: repo.githubDescription || t('library.row.description.placeholder'),
    // A textarea's content is its child text node — writing only the `value`
    // property would leave the markup empty if it is ever serialised.
    text: repo.shortDescription,
    onInput: (event) => {
      commitDescription(event.target.value);
      renderCounter(event.target.value.length);
    },
    // Flush when the card loses focus so a fast "refresh" cannot drop the edit.
    onBlur: () => commitDescription.flush(),
  });

  const counter = h('span', { class: 'text-2xs tabular-nums text-ink-400' });
  const origin = h('span', { class: 'text-2xs text-ink-400' });

  /* ── Personal notes ──────────────────────────────────────────────────
     These are the visitor's own words. Nothing here is derived from GitHub,
     so a re-fetch cannot overwrite them — the only thing that changes a note
     is the visitor editing it. Emptying the field returns the project to the
     "writable block" state rather than printing a blank heading. */

  const commitNotes = debounce((value) => onPatch(slug, { notes: value === '' ? null : value }), 220);

  const notes = h('textarea', {
    id: notesId,
    class: 'input min-h-[4rem] resize-y py-1.5 text-xs leading-relaxed',
    rows: '2',
    maxlength: String(NOTES_MAX_LENGTH),
    'aria-label': t('library.row.notes.label'),
    placeholder: t('library.row.notes.placeholder'),
    text: repo.notes ?? '',
    onInput: (event) => {
      commitNotes(event.target.value);
      renderNotesCounter(event.target.value.length);
    },
    onBlur: () => commitNotes.flush(),
  });

  const notesCounter = h('span', { class: 'text-2xs tabular-nums text-ink-400' });
  const notesHint = h('span', {
    class: 'text-2xs leading-relaxed text-ink-400',
    text: t('library.row.notes.hint'),
    'data-i18n': 'library.row.notes.hint',
  });

  function renderNotesCounter(length) {
    notesCounter.textContent = t('library.row.notes.counter', {
      count: length ?? notes.value.length,
    });
  }

  const resetButton = h(
    'button',
    {
      type: 'button',
      class: 'btn-icon h-6 w-6 shrink-0',
      'aria-label': t('library.row.description.resetLabel', { name: repo.name }),
      'data-tooltip': t('library.row.description.reset'),
      onClick: () => {
        commitDescription.cancel();
        description.value = repo.githubDescription ?? '';
        onPatch(slug, { shortDescription: null });
      },
    },
    icon('undo', { size: 12 }),
  );

  function renderCounter(length) {
    counter.textContent = t('library.row.description.counter', {
      count: length ?? description.value.length,
    });
  }

  renderNotesCounter((repo.notes ?? '').length);

  /* ── Card ──────────────────────────────────────────────────────────── */

  const el = h(
    'article',
    {
      class: 'repo-card',
      dataset: { slug, visible: String(repo.visible), status: repo.status },
      role: 'listitem',
    },
    h(
      'div',
      { class: 'flex items-start gap-2.5' },
      h('div', { class: 'flex w-16 shrink-0 flex-col items-center gap-1 pt-0.5' }, visibility, includeLabel),
      h(
        'div',
        { class: 'min-w-0 flex-1' },
        h(
          'div',
          { class: 'flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5' },
          h('div', { class: 'min-w-0' }, titleLink, metaLine),
          h('div', { class: 'flex flex-col items-end gap-1.5' }, linkBadges, badges),
        ),
      ),
    ),
    h(
      'div',
      { class: 'ml-[4.5rem] mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)]' },
      h(
        'div',
        { class: 'min-w-0' },
        h('label', { class: 'mb-1 flex items-center gap-1.5', for: statusId },
          h('span', {
            class: 'text-2xs font-semibold uppercase tracking-wide text-ink-500',
            text: t('library.row.status.label'),
            'data-i18n': 'library.row.status.label',
          }),
          statusOrigin,
        ),
        statusSelect,
        statusReason,
      ),
      h(
        'div',
        { class: 'min-w-0' },
        h('label', { class: 'mb-1 block', for: descriptionId },
          h('span', {
            class: 'text-2xs font-semibold uppercase tracking-wide text-ink-500',
            text: t('library.row.description.label'),
            'data-i18n': 'library.row.description.label',
          }),
        ),
        description,
        h(
          'div',
          { class: 'mt-1 flex items-center gap-2' },
          origin,
          h('span', { class: 'ml-auto flex items-center gap-1' }, counter, resetButton),
        ),
      ),
      h(
        'div',
        { class: 'min-w-0 sm:col-span-2' },
        h(
          'label',
          { class: 'mb-1 flex items-center gap-1.5', for: notesId },
          h('span', {
            class: 'text-2xs font-semibold uppercase tracking-wide text-ink-500',
            text: t('library.row.notes.label'),
            'data-i18n': 'library.row.notes.label',
          }),
          icon('pen', { size: 11, class: 'text-ink-300' }),
        ),
        notes,
        h(
          'div',
          { class: 'mt-1 flex items-start gap-2' },
          notesHint,
          h('span', { class: 'ml-auto shrink-0' }, notesCounter),
        ),
      ),
    ),
  );

  /* ── Update in place ───────────────────────────────────────────────── */

  function update(next) {
    el.dataset.visible = String(next.visible);
    el.dataset.status = next.status;

    if (visibility.checked !== next.visible && document.activeElement !== visibility) {
      visibility.checked = next.visible;
    }
    visibility.setAttribute('aria-label', t('library.row.includeLabel', { name: next.name }));
    setText(includeLabel, t('library.row.include'));

    titleLink.href = next.url;
    setText(titleLink, humanizeRepoName(next.name));

    if (statusSelect.value !== next.status) statusSelect.value = next.status;
    statusSelect.setAttribute('aria-label', t('library.row.status.labelFor', { name: next.name }));

    // The textarea is the one field a visitor can be mid-sentence in.
    if (document.activeElement !== description) {
      if (description.value !== next.shortDescription) description.value = next.shortDescription;
      renderCounter(next.shortDescription.length);
    } else {
      renderCounter();
    }
    // Same courtesy for the notes: never yank the field out from under
    // somebody who is mid-sentence.
    if (document.activeElement !== notes) {
      const incoming = next.notes ?? '';
      if (notes.value !== incoming) notes.value = incoming;
      renderNotesCounter(incoming.length);
    } else {
      renderNotesCounter();
    }
    notes.setAttribute('aria-label', t('library.row.notes.label'));
    notes.placeholder = t('library.row.notes.placeholder');

    description.placeholder = next.githubDescription || t('library.row.description.placeholder');
    description.setAttribute('aria-label', t('library.row.description.label'));
    resetButton.setAttribute('aria-label', t('library.row.description.resetLabel', { name: next.name }));
    resetButton.setAttribute('data-tooltip', t('library.row.description.reset'));

    renderOrigin(next);
    renderStatusReason(next);
    renderBadges(next);
    renderLinks(next);
    renderMeta(next);
  }

  /** "edited" vs "from GitHub" under the description. */
  function renderOrigin(next) {
    const custom = next.summaryIsCustom;
    setText(origin, t(custom ? 'library.row.description.edited' : 'library.row.description.auto'));
    origin.className = custom
      ? 'text-2xs font-medium text-brass-600'
      : 'text-2xs text-ink-400';
  }

  function renderStatusReason(next) {
    setText(statusOrigin, t(next.statusIsManual ? 'library.row.status.manual' : 'library.row.status.auto'));
    statusOrigin.className = next.statusIsManual
      ? 'chip !px-1.5 !py-0 text-[10px] border-brass-200 bg-brass-50 text-brass-700'
      : 'chip !px-1.5 !py-0 text-[10px]';

    const key = next.statusReason;
    const detail = next.statusDetail;
    setText(
      statusReason,
      t(`status.reasons.${key}`, {
        detail: detail ?? '',
        time: next.updatedAt ? formatRelativeTime(next.updatedAt, locale()) : t('common.unknown'),
      }),
    );
  }

  function renderBadges(next) {
    /** @type {{ text: string, tone: string }[]} */
    const items = [];

    if (next.isPrivate) items.push({ text: t('library.row.private'), tone: 'ember' });
    if (next.isFork) items.push({ text: t('library.row.fork'), tone: 'neutral' });
    if (next.archived) items.push({ text: t('library.row.archived'), tone: 'neutral' });
    if (next.disabled) items.push({ text: t('library.row.disabled'), tone: 'crimson' });
    if (next.language) items.push({ text: next.language, tone: 'azure' });
    items.push({ text: t(`status.${next.status}`), tone: TONE_BY_STATUS[next.status] ?? 'neutral' });

    badges.replaceChildren(
      ...items.map((item) => h('span', { class: `badge badge--${item.tone}`, text: item.text })),
    );
  }

  /** Clickable links out to GitHub and to the live project, when it has one. */
  function renderLinks(next) {
    /** @type {HTMLElement[]} */
    const links = [
      h(
        'a',
        {
          class: 'link-badge',
          href: next.url,
          target: '_blank',
          rel: 'noopener noreferrer',
          title: next.slug,
        },
        icon('github', { size: 12 }),
        h('span', { text: t('library.row.openOnGithub'), 'data-i18n': 'library.row.openOnGithub' }),
      ),
    ];

    // The homepage is the one link badge whose target the *repository owner*
    // controls, so it goes through the same allow-list the book uses — a
    // `javascript:` (or data:/vbscript:) homepage must never become a live href
    // here, and a scheme-less address is normalised exactly as on the cover.
    const homepageHref = safeUrl(next.homepage);
    if (homepageHref) {
      links.push(
        h(
          'a',
          {
            class: 'link-badge link-badge--accent',
            href: homepageHref,
            target: '_blank',
            rel: 'noopener noreferrer',
            title: homepageHref,
          },
          icon('external', { size: 12 }),
          h('span', { text: t('library.row.homepage'), 'data-i18n': 'library.row.homepage' }),
        ),
      );
    }

    linkBadges.replaceChildren(...links);
  }

  function renderMeta(next) {
    const parts = [
      h(
        'span',
        { class: 'inline-flex items-center gap-1' },
        icon('star', { size: 11 }),
        formatCompact(next.stars ?? 0, locale()),
      ),
      h(
        'span',
        { class: 'inline-flex items-center gap-1' },
        icon('fork', { size: 11 }),
        formatCompact(next.forks ?? 0, locale()),
      ),
    ];

    if (next.updatedAt) {
      parts.push(
        h('span', { text: t('library.row.updated', { time: formatRelativeTime(next.updatedAt, locale()) }) }),
      );
    }
    parts.push(
      h('span', {
        text: next.license ?? t('library.row.noLicense'),
        ...(next.license ? {} : { 'data-i18n': 'library.row.noLicense' }),
      }),
    );
    if (next.topics?.length) {
      parts.push(
        h('span', { class: 'truncate', title: next.topics.join(', ') }, `#${next.topics.slice(0, 3).join(' #')}`),
      );
    }
    parts.push(
      h('span', { class: 'ml-auto hidden font-mono text-[10px] text-ink-300 lg:inline' }, truncate(next.slug, 44)),
    );

    metaLine.replaceChildren(...parts);
  }

  update(repo);

  return {
    el,
    update,
    destroy() {
      commitDescription.cancel();
    },
  };
}
