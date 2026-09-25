/**
 * Hero panel: what the product is, plus the fastest path to a first result.
 *
 * Shows a live stat strip (repositories, chapters, language, connection) and a
 * "start here" card with the GitHub username field until the first fetch lands.
 *
 * @module components/HeroPanel
 */

import { h, setInputValue, setText } from '../core/dom.js';
import { UI_EVENTS } from '../core/events.js';
import { selectStats, selectViews } from '../state/selectors.js';
import { languageName } from '../i18n/index.js';
import { icon } from './ui/Icon.js';

/**
 * @param {object} ctx
 * @param {import('../core/store.js').Store} ctx.settings
 * @param {import('../core/store.js').Store} ctx.session
 * @param {import('../core/i18n.js').I18n} ctx.i18n
 * @param {(key: string, params?: object) => string} ctx.t
 * @param {import('../core/events.js').ReturnType} ctx.bus
 */
export function HeroPanel(ctx) {
  const { settings, session, i18n, t, bus } = ctx;

  /* ── Static copy ───────────────────────────────────────────────────── */

  const eyebrow = h(
    'span',
    { class: 'chip' },
    icon('sparkles', { size: 13, class: 'text-brass-500' }),
    h('span', { text: t('hero.eyebrow'), 'data-i18n': 'hero.eyebrow' }),
  );

  const title = h('h1', {
    id: 'hero-title',
    class: 'mt-3 max-w-3xl font-serif text-3xl font-semibold leading-tight text-ink-900 sm:text-4xl',
    text: t('hero.title'),
    'data-i18n': 'hero.title',
  });

  const subtitle = h('p', {
    class: 'mt-3 max-w-2xl text-sm leading-relaxed text-ink-600 sm:text-base',
    text: t('hero.subtitle'),
    'data-i18n': 'hero.subtitle',
  });

  /* ── Stat strip ────────────────────────────────────────────────────── */

  function statBlock({ iconName, labelKey, valueClass = 'text-ink-900' }) {
    const value = h('dd', { class: ['font-serif text-xl font-semibold tabular-nums', valueClass], text: '—' });
    const label = h('dt', {
      class: 'mt-0.5 text-2xs font-semibold uppercase tracking-[0.12em] text-ink-400',
      text: t(labelKey),
      'data-i18n': labelKey,
    });
    const el = h(
      'div',
      { class: 'flex min-w-0 items-start gap-2.5 px-4 py-3' },
      h('span', { class: 'mt-0.5 shrink-0 text-brass-500' }, icon(iconName, { size: 16 })),
      h('div', { class: 'min-w-0' }, value, label),
    );
    return { el, value, label };
  }

  const stats = {
    repos: statBlock({ iconName: 'library', labelKey: 'hero.stats.repos' }),
    chapters: statBlock({ iconName: 'book', labelKey: 'hero.stats.chapters' }),
    language: statBlock({ iconName: 'language', labelKey: 'hero.stats.language' }),
    connection: statBlock({ iconName: 'shield', labelKey: 'hero.stats.connection' }),
  };

  const statStrip = h(
    'dl',
    {
      class:
        'card mt-6 grid grid-cols-2 divide-x divide-y divide-paper-200 overflow-hidden sm:grid-cols-4 sm:divide-y-0',
    },
    stats.repos.el,
    stats.chapters.el,
    stats.language.el,
    stats.connection.el,
  );

  /* ── Start card (quick username + fetch) ───────────────────────────── */

  const usernameInput = h('input', {
    id: 'hero-username',
    type: 'text',
    class: 'input',
    placeholder: t('library.quickFetch.placeholder'),
    'data-i18n-placeholder': 'library.quickFetch.placeholder',
    autocomplete: 'username',
    spellcheck: 'false',
    maxlength: '39',
    value: settings.state.githubUsername,
    onInput: (event) => settings.set('githubUsername', event.target.value.trim().replace(/^@/, '')),
    onKeydown: (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        bus.emit(UI_EVENTS.fetchRepos);
      }
    },
  });

  const startLabel = h('label', {
    for: 'hero-username',
    class: 'label',
    text: t('library.quickFetch.label'),
    'data-i18n': 'library.quickFetch.label',
  });

  const startButton = h(
    'button',
    { type: 'button', class: 'btn btn-primary shrink-0', onClick: () => bus.emit(UI_EVENTS.fetchRepos) },
    icon('fetch', { size: 16 }),
    h('span', { class: 'start-button-label', text: t('library.quickFetch.cta') }),
  );

  const startCard = h(
    'div',
    { class: 'card mt-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-end' },
    h('div', { class: 'field min-w-0 flex-1' }, startLabel, usernameInput),
    startButton,
  );

  const steps = h(
    'ol',
    { class: 'mt-4 flex flex-col gap-1.5 text-xs text-ink-500 sm:flex-row sm:items-center sm:gap-4' },
    h('li', { class: 'font-semibold uppercase tracking-[0.12em] text-ink-400', text: t('hero.steps.title'), 'data-i18n': 'hero.steps.title' }),
    ...['first', 'second', 'third'].map((step, index) =>
      h(
        'li',
        { class: 'flex items-center gap-1.5' },
        h(
          'span',
          { class: 'flex h-4 w-4 items-center justify-center rounded-full bg-paper-300 text-[10px] font-bold text-ink-700' },
          String(index + 1),
        ),
        h('span', { text: t(`hero.steps.${step}`), 'data-i18n': `hero.steps.${step}` }),
      ),
    ),
  );

  const el = h('div', { class: 'pb-2' }, eyebrow, title, subtitle, statStrip, startCard, steps);

  /* ── Sync ──────────────────────────────────────────────────────────── */

  function sync() {
    const snapshot = selectStats(selectViews(session.state, settings.state));

    setText(stats.repos.value, i18n.formatNumber(snapshot.total));
    setText(stats.chapters.value, i18n.formatNumber(snapshot.visible));
    setText(stats.language.value, languageName(settings.state.language));

    const hasToken = Boolean(settings.state.personalAccessToken);
    const username = settings.state.githubUsername;
    setText(
      stats.connection.value,
      username
        ? hasToken
          ? t('hero.connection.user', { username })
          : username
        : hasToken
          ? t('hero.connection.token')
          : t('hero.connection.anonymous'),
    );
    stats.connection.value.classList.toggle('truncate', Boolean(username));
    stats.connection.value.classList.toggle('text-base', Boolean(username));

    // Hide the onboarding card once a library exists.
    const hasRepos = session.state.repos.length > 0;
    startCard.classList.toggle('hidden', hasRepos);
    steps.classList.toggle('hidden', hasRepos);

    setInputValue(usernameInput, settings.state.githubUsername);
    setText(startButton.querySelector('.start-button-label'), t('library.quickFetch.cta'));
    startButton.disabled = session.state.status === 'loading';
  }

  const disposers = [
    i18n.onChange(sync),
    session.subscribe(['repos', 'status'], sync),
    settings.subscribe(['language', 'githubUsername', 'personalAccessToken'], sync),
  ];

  sync();

  return {
    el,
    sync,
    destroy() {
      for (const dispose of disposers) dispose();
    },
  };
}
