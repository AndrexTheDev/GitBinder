/**
 * Settings drawer.
 *
 * Slide-over panel holding every piece of persisted configuration:
 *   • GitHub connection (username + optional Personal Access Token)
 *   • Book metadata (title, author, e-mail)
 *   • Interface language
 *   • Data portability (export / import / reset / clear)
 *   • A plain-language security note about where the token lives
 *
 * All fields write straight into the store, which debounces the localStorage
 * write and notifies the rest of the UI — so the book preview updates while you
 * type and there is no "save" step to forget.
 *
 * @module components/SettingsDrawer
 */

import { h, setInputValue, setText } from '../core/dom.js';
import { UI_EVENTS } from '../core/events.js';
import { APP_NAME, GITHUB } from '../config/app.js';
import { DEFAULT_BOOK_TITLE } from '../state/schema.js';
import { LANGUAGES } from '../i18n/index.js';
import { formatBytes, isValidEmail, isValidGithubUsername } from '../utils/format.js';
import { downloadJSON, pickFiles, readFileAsText, timestampedFilename } from '../utils/file.js';
import { GithubError, verifyToken } from '../services/github.js';
import { createOverlay } from './ui/Overlay.js';
import { confirmDialog } from './ui/Confirm.js';
import { icon } from './ui/Icon.js';
import { createCheckbox, createSelectField, createTextField, noteBox, sectionHeading } from './ui/Field.js';

/**
 * @param {object} ctx
 * @param {import('../core/store.js').Store} ctx.settings
 * @param {import('../core/i18n.js').I18n} ctx.i18n
 * @param {(key: string, params?: object) => string} ctx.t
 * @param {import('../core/events.js').ReturnType} ctx.bus
 * @param {import('./ui/Toast.js').Toaster} ctx.toaster
 * @param {import('../core/vault.js').Vault} [ctx.vault]
 */
export function SettingsDrawer(ctx) {
  const { settings, i18n, t, bus, toaster, vault } = ctx;

  /** Section handles — rebuilt every time the drawer opens. */
  let sections = [];
  /** @type {AbortController|null} */
  let verifyController = null;

  /* ------------------------------------------------------------------ *
   * Section: GitHub connection
   * ------------------------------------------------------------------ */

  function buildGithubSection() {
    const state = settings.state;

    const username = createTextField({
      t,
      id: 'settings-username',
      labelKey: 'settings.username.label',
      hintKey: 'settings.username.hint',
      placeholderKey: 'settings.username.placeholder',
      value: state.githubUsername,
      maxlength: 39,
      autocomplete: 'username',
      onInput: (value) => {
        settings.set('githubUsername', value.trim().replace(/^@/, ''));
        username.setError(value && !isValidGithubUsername(value) ? t('settings.username.invalid') : null);
      },
      onEnter: () => {
        bus.emit(UI_EVENTS.fetchRepos);
        bus.emit(UI_EVENTS.closeSettings);
      },
    });
    username.input.setAttribute('data-autofocus', '');

    const tokenBadge = h('span', { class: 'badge badge--neutral' });

    const toggleToken = h(
      'button',
      {
        type: 'button',
        class: 'affix-action',
        'aria-label': t('settings.token.show'),
        onClick: () => {
          const reveal = token.input.type === 'password';
          token.input.type = reveal ? 'text' : 'password';
          toggleToken.replaceChildren(icon(reveal ? 'eyeOff' : 'eye', { size: 15 }));
          toggleToken.setAttribute(
            'aria-label',
            t(reveal ? 'settings.token.hide' : 'settings.token.show'),
          );
          token.input.focus({ preventScroll: true });
        },
      },
      icon('eye', { size: 15 }),
    );

    const token = createTextField({
      t,
      id: 'settings-token',
      type: 'password',
      labelKey: 'settings.token.label',
      hintKey: 'settings.token.hint',
      placeholderKey: 'settings.token.placeholder',
      value: state.personalAccessToken,
      optional: true,
      optionalLabel: t('common.optional'),
      maxlength: 255,
      monospace: true,
      trailing: toggleToken,
      onInput: (value) => {
        settings.set('personalAccessToken', value.trim());
        syncTokenState();
      },
    });

    // Surface "stored / not stored" next to the field label.
    token.shell.labelEl.parentElement.append(tokenBadge);

    const verifyLabel = h('span', { text: t('settings.token.verify') });
    const verifyIcon = icon('shield', { size: 15 });
    const verifyButton = h(
      'button',
      { type: 'button', class: 'btn btn-outline', onClick: runVerify },
      verifyIcon,
      verifyLabel,
    );

    const clearTokenButton = h(
      'button',
      {
        type: 'button',
        class: 'btn btn-ghost',
        onClick: () => {
          settings.set('personalAccessToken', '');
          token.setValue('');
          syncTokenState();
          token.input.focus({ preventScroll: true });
        },
      },
      icon('trash', { size: 15 }),
      h('span', { text: t('settings.token.clear'), 'data-i18n': 'settings.token.clear' }),
    );

    const verifyResult = h('p', { class: 'hidden items-center gap-1.5 text-xs font-semibold' });

    const docsLink = h(
      'a',
      {
        class:
          'inline-flex items-center gap-1 text-xs font-semibold text-brass-600 underline underline-offset-2 hover:text-brass-700',
        href: GITHUB.tokenDocsUrl,
        target: '_blank',
        rel: 'noopener noreferrer',
      },
      h('span', { text: t('settings.token.docs'), 'data-i18n': 'settings.token.docs' }),
      icon('external', { size: 12 }),
    );

    function syncTokenState() {
      const has = Boolean(settings.state.personalAccessToken);
      setText(tokenBadge, has ? t('settings.token.stored') : t('settings.token.empty'));
      tokenBadge.className = `badge ${has ? 'badge--forest' : 'badge--neutral'}`;
      clearTokenButton.disabled = !has;
      verifyButton.disabled = !has;
      verifyResult.classList.add('hidden');
      verifyResult.classList.remove('flex');
    }

    async function runVerify() {
      const value = settings.state.personalAccessToken;
      if (!value) return;

      verifyController?.abort();
      verifyController = new AbortController();

      verifyButton.disabled = true;
      setText(verifyLabel, t('settings.token.verifying'));
      verifyIcon.classList.add('animate-spin');

      try {
        const result = await verifyToken(value, { signal: verifyController.signal });
        verifyResult.className = 'flex items-center gap-1.5 text-xs font-semibold text-forest-700';
        verifyResult.replaceChildren(
          icon('success', { size: 14 }),
          h('span', {
            text: result.plan
              ? t('settings.token.valid', { login: result.login, plans: result.plan })
              : t('settings.token.validSimple', { login: result.login }),
          }),
        );
      } catch (error) {
        verifyResult.className = 'flex items-center gap-1.5 text-xs font-semibold text-crimson-700';
        verifyResult.replaceChildren(
          icon('error', { size: 14 }),
          h('span', {
            text:
              error instanceof GithubError
                ? t(error.i18nKey, { status: error.status ?? '', username: error.username ?? '' })
                : t('settings.token.invalid'),
          }),
        );
      } finally {
        verifyButton.disabled = false;
        setText(verifyLabel, t('settings.token.verify'));
        verifyIcon.classList.remove('animate-spin');
      }
    }

    syncTokenState();

    return {
      el: h(
        'section',
        { class: 'space-y-4' },
        sectionHeading({ t, titleKey: 'settings.sections.github', iconName: 'github' }),
        username.el,
        token.el,
        h('div', { class: 'flex flex-wrap items-center gap-2' }, verifyButton, clearTokenButton, docsLink),
        verifyResult,
        h('p', {
          class: 'hint',
          text: t('settings.token.scopes', { scopes: GITHUB.requiredScopes.join(', ') }),
        }),
        noteBox({ t, tone: 'warning', iconName: 'lock', textKey: 'settings.token.securityNote' }),
      ),
      sync() {
        syncTokenState();
        setInputValue(username.input, settings.state.githubUsername);
        setInputValue(token.input, settings.state.personalAccessToken);
        setText(verifyLabel, t('settings.token.verify'));
        toggleToken.setAttribute(
          'aria-label',
          t(token.input.type === 'password' ? 'settings.token.show' : 'settings.token.hide'),
        );
      },
      destroy() {
        verifyController?.abort();
      },
    };
  }

  /* ------------------------------------------------------------------ *
   * Section: book metadata
   * ------------------------------------------------------------------ */

  function buildBookSection() {
    const state = settings.state;

    const bookTitle = createTextField({
      t,
      id: 'settings-book-title',
      labelKey: 'settings.bookTitle.label',
      hintKey: 'settings.bookTitle.hint',
      placeholderKey: 'settings.bookTitle.placeholder',
      value: state.customBookTitle,
      maxlength: 160,
      onInput: (value) => settings.set('customBookTitle', value),
    });

    const resetTitle = h(
      'button',
      {
        type: 'button',
        class: 'btn btn-ghost text-xs',
        onClick: () => {
          settings.set('customBookTitle', DEFAULT_BOOK_TITLE);
          bookTitle.setValue(DEFAULT_BOOK_TITLE);
        },
      },
      icon('undo', { size: 14 }),
      h('span', { text: t('settings.bookTitle.reset'), 'data-i18n': 'settings.bookTitle.reset' }),
    );

    const authorName = createTextField({
      t,
      id: 'settings-author-name',
      labelKey: 'settings.authorName.label',
      hintKey: 'settings.authorName.hint',
      placeholderKey: 'settings.authorName.placeholder',
      value: state.authorName,
      maxlength: 120,
      onInput: (value) => settings.set('authorName', value),
    });

    const authorEmail = createTextField({
      t,
      id: 'settings-author-email',
      type: 'email',
      labelKey: 'settings.authorEmail.label',
      hintKey: 'settings.authorEmail.hint',
      placeholderKey: 'settings.authorEmail.placeholder',
      value: state.authorEmail,
      optional: true,
      optionalLabel: t('common.optional'),
      maxlength: 254,
      autocomplete: 'email',
      onInput: (value) => {
        settings.set('authorEmail', value);
        authorEmail.setError(value && !isValidEmail(value) ? t('settings.authorEmail.invalid') : null);
      },
    });

    const authorBio = createTextField({
      t,
      id: 'settings-author-bio',
      labelKey: 'settings.authorBio.label',
      hintKey: 'settings.authorBio.hint',
      placeholderKey: 'settings.authorBio.placeholder',
      value: state.authorBio,
      optional: true,
      optionalLabel: t('common.optional'),
      maxlength: 280,
      onInput: (value) => settings.set('authorBio', value),
    });

    return {
      el: h(
        'section',
        { class: 'space-y-4' },
        sectionHeading({ t, titleKey: 'settings.sections.book', iconName: 'notebook' }),
        bookTitle.el,
        h('div', { class: '-mt-2 flex justify-end' }, resetTitle),
        authorName.el,
        authorEmail.el,
        authorBio.el,
      ),
      sync() {
        setInputValue(bookTitle.input, settings.state.customBookTitle);
        setInputValue(authorName.input, settings.state.authorName);
        setInputValue(authorEmail.input, settings.state.authorEmail);
        setInputValue(authorBio.input, settings.state.authorBio);
      },
      destroy() {},
    };
  }

  /* ------------------------------------------------------------------ *
   * Section: language
   * ------------------------------------------------------------------ */

  function buildLanguageSection() {
    const language = createSelectField({
      t,
      id: 'settings-language',
      labelKey: 'settings.language.label',
      hintKey: 'settings.language.hint',
      value: settings.state.language,
      options: LANGUAGES.map((entry) => ({
        value: entry.code,
        label: `${entry.nativeLabel} (${entry.label})`,
      })),
      onChange: (value) => settings.set('language', value),
    });

    const detected = h('p', { class: 'hint flex items-center gap-1.5' });

    function syncDetected() {
      const code = i18n.detectFromEnvironment();
      detected.replaceChildren(
        icon('globe', { size: 13 }),
        h('span', {
          text: t('settings.language.auto', {
            language: LANGUAGES.find((entry) => entry.code === code)?.nativeLabel ?? code,
          }),
        }),
      );
    }
    syncDetected();

    return {
      el: h(
        'section',
        { class: 'space-y-3' },
        sectionHeading({ t, titleKey: 'settings.sections.language', iconName: 'language' }),
        language.el,
        detected,
      ),
      sync() {
        language.setValue(settings.state.language);
        syncDetected();
      },
      destroy() {},
    };
  }

  /* ------------------------------------------------------------------ *
   * Section: data portability
   * ------------------------------------------------------------------ */

  function buildDataSection() {
    const includeToken = createCheckbox({
      t,
      labelKey: 'settings.data.exportIncludeToken',
      hintKey: 'settings.data.exportIncludeTokenWarning',
      checked: false,
    });

    const mergeMode = createCheckbox({
      t,
      labelKey: 'settings.data.importModeMerge',
      hintKey: 'settings.data.importModeHint',
      checked: false,
    });

    const exportButton = h(
      'button',
      {
        type: 'button',
        class: 'btn btn-outline w-full',
        onClick: () => {
          const withSecrets = includeToken.input.checked;
          downloadJSON(
            timestampedFilename('gitbinder-settings'),
            settings.exportJSON({ includeSecrets: withSecrets }),
          );
          toaster?.push({
            tone: 'success',
            title: t('settings.data.export'),
            message: withSecrets
              ? `${t('settings.data.exportSuccess')} · ${t('settings.data.exportIncludeToken')}`
              : t('settings.data.exportSuccess'),
          });
        },
      },
      icon('download', { size: 15 }),
      h('span', { text: t('settings.data.export'), 'data-i18n': 'settings.data.export' }),
    );

    const importButton = h(
      'button',
      { type: 'button', class: 'btn btn-outline w-full', onClick: runImport },
      icon('upload', { size: 15 }),
      h('span', { text: t('settings.data.import'), 'data-i18n': 'settings.data.import' }),
    );

    async function runImport() {
      const files = await pickFiles({ accept: '.json,application/json' });
      const file = files?.[0];
      if (!file) return;

      let payload;
      try {
        payload = JSON.parse(await readFileAsText(file));
      } catch {
        toaster?.push({ tone: 'error', message: t('errors.invalidJson') });
        return;
      }

      const result = settings.importJSON(payload, { merge: mergeMode.input.checked });
      toaster?.push(
        result.ok
          ? { tone: 'success', title: t('settings.data.import'), message: t('settings.data.importSuccess') }
          : { tone: 'error', message: t('settings.data.importInvalid') },
      );
      if (result.ok) sync();
    }

    const resetButton = h(
      'button',
      { type: 'button', class: 'btn btn-ghost w-full sm:w-auto', onClick: runReset },
      icon('reset', { size: 15 }),
      h('span', { text: t('settings.data.reset'), 'data-i18n': 'settings.data.reset' }),
    );

    const clearButton = h(
      'button',
      { type: 'button', class: 'btn btn-danger w-full sm:w-auto', onClick: runClear },
      icon('trash', { size: 15 }),
      h('span', { text: t('settings.data.clear'), 'data-i18n': 'settings.data.clear' }),
    );

    async function runReset() {
      const ok = await confirmDialog({
        t,
        title: t('settings.data.reset'),
        message: t('settings.data.resetConfirm'),
        confirmLabel: t('settings.data.reset'),
        tone: 'warning',
        iconName: 'reset',
      });
      if (!ok) return;
      settings.reset();
      toaster?.push({ tone: 'success', message: t('settings.data.resetSuccess') });
      sync();
    }

    async function runClear() {
      const ok = await confirmDialog({
        t,
        title: t('settings.data.clear'),
        message: t('settings.data.clearConfirm'),
        confirmLabel: t('common.delete'),
        tone: 'danger',
      });
      if (!ok) return;
      vault?.destroy();
      settings.clearStorage();
      settings.reset();
      toaster?.push({ tone: 'success', message: t('settings.data.clearSuccess') });
      sync();
    }

    const storageLine = h('p', { class: 'hint flex items-center gap-1.5' });

    function syncStorage() {
      const info = settings.storageInfo();
      storageLine.replaceChildren(
        icon(info.memoryOnly ? 'warning' : 'database', { size: 13 }),
        h('span', {
          text: info.memoryOnly
            ? t('settings.security.memoryOnly')
            : t('settings.security.storageUsed', { size: formatBytes(info.bytes, i18n.locale) }),
        }),
      );
    }
    syncStorage();

    return {
      el: h(
        'section',
        { class: 'space-y-4' },
        sectionHeading({ t, titleKey: 'settings.sections.data', iconName: 'file' }),

        h(
          'div',
          { class: 'panel-inset space-y-3 p-3' },
          exportButton,
          includeToken.el,
          h('p', { class: 'hint', text: t('settings.data.exportHint'), 'data-i18n': 'settings.data.exportHint' }),
        ),

        h(
          'div',
          { class: 'panel-inset space-y-3 p-3' },
          importButton,
          mergeMode.el,
          h('p', { class: 'hint', text: t('settings.data.importHint'), 'data-i18n': 'settings.data.importHint' }),
        ),

        h('div', { class: 'gilt-rule' }),

        h('div', { class: 'flex flex-wrap gap-2' }, resetButton, clearButton),
        h('p', { class: 'hint', text: t('settings.data.resetHint'), 'data-i18n': 'settings.data.resetHint' }),
        storageLine,
      ),
      sync: syncStorage,
      destroy() {},
    };
  }

  /* ------------------------------------------------------------------ *
   * Drawer assembly
   * ------------------------------------------------------------------ */

  const overlay = createOverlay({
    variant: 'drawer',
    title: t('settings.title'),
    subtitle: t('settings.subtitle'),
    closeLabel: t('common.close'),
    iconName: 'settings',
    onClose: () => {
      verifyController?.abort();
      bus.emit(UI_EVENTS.closeSettings);
    },
    render(body, api) {
      for (const section of sections) section.destroy();
      sections = [buildGithubSection(), buildBookSection(), buildLanguageSection(), buildDataSection()];

      body.classList.add('space-y-6');

      /** @type {Node[]} */
      const parts = [];
      sections.forEach((section, index) => {
        if (index > 0) parts.push(h('div', { class: 'gilt-rule' }));
        parts.push(section.el);
      });

      body.append(
        ...parts,
        h('div', { class: 'gilt-rule' }),
        noteBox({
          t,
          tone: 'neutral',
          iconName: 'shield',
          titleKey: 'settings.security.title',
          textKey: 'settings.security.body',
        }),
      );

      api.setFooter(
        h('p', { class: 'mr-auto hidden text-xs text-ink-400 sm:block', text: APP_NAME }),
        h(
          'button',
          { type: 'button', class: 'btn btn-primary', 'data-i18n': 'settings.done', onClick: () => api.close() },
          t('settings.done'),
        ),
      );

      sync();
    },
  });

  /** Re-resolve everything a `data-i18n` binding cannot cover. */
  function sync() {
    overlay.setTitle(t('settings.title'));
    overlay.setSubtitle(t('settings.subtitle'));
    overlay.setCloseLabel(t('common.close'));
    for (const section of sections) section.sync?.();
  }

  const disposers = [
    i18n.onChange(sync),
    settings.subscribe(
      [
        'githubUsername',
        'personalAccessToken',
        'customBookTitle',
        'authorName',
        'authorEmail',
        'authorBio',
        'language',
      ],
      () => {
        if (overlay.isOpen()) sync();
      },
    ),
    bus.on(UI_EVENTS.openSettings, () => overlay.open()),
    bus.on(UI_EVENTS.closeSettings, () => overlay.close()),
  ];

  return {
    el: overlay.el,
    open: () => overlay.open(),
    close: () => overlay.close(),
    isOpen: () => overlay.isOpen(),
    sync,
    destroy() {
      for (const dispose of disposers) dispose();
      for (const section of sections) section.destroy();
      overlay.destroy();
    },
  };
}
