/**
 * English dictionary (fallback locale).
 *
 * Conventions
 * ───────────
 * • Keys are grouped by feature namespace (`nav.*`, `settings.*`, …).
 * • `{placeholder}` is interpolated by `i18n.t()`; `{{value}}` is HTML-escaped,
 *   `{{{html}}}` is inserted raw.
 * • Objects with `one` / `other` are resolved through `Intl.PluralRules`.
 * • Every key here MUST exist in `de.js` — `tests/i18n.test.js` enforces parity.
 */
export default {
  meta: {
    title: 'GitBooklet — Your GitHub portfolio as a classic book',
    tagline: 'Turn your repositories into a printable Classic Book.',
    description:
      'GitBooklet is a free, client-side tool that composes your GitHub repositories into a book-like PDF portfolio. Nothing leaves your browser except the requests you trigger yourself.',
  },

  common: {
    save: 'Save',
    cancel: 'Cancel',
    close: 'Close',
    confirm: 'Confirm',
    delete: 'Delete',
    remove: 'Remove',
    reset: 'Reset',
    retry: 'Try again',
    copy: 'Copy',
    copied: 'Copied',
    loading: 'Loading…',
    search: 'Search',
    all: 'All',
    none: 'None',
    optional: 'optional',
    required: 'required',
    yes: 'Yes',
    no: 'No',
    apply: 'Apply',
    back: 'Back',
    unknown: 'Unknown',
    never: 'never',
    enabled: 'Enabled',
    disabled: 'Disabled',
    characters: '{count} characters',
    showing: 'Showing {shown} of {total}',
  },

  a11y: {
    skipToContent: 'Skip to content',
    mainNavigation: 'Main navigation',
    languageSwitch: 'Interface language',
    toastRegion: 'Notifications',
    repositoryList: 'Repository list',
    bookSummary: 'Book summary',
    closeDialog: 'Close dialog',
    openSupport: 'Open support dialog',
    openSettings: 'Open settings',
    togglePassword: 'Show or hide the access token',
  },

  nav: {
    brand: {
      name: 'GitBooklet',
      tagline: 'Your repositories, bound as a book',
    },
    language: {
      label: 'Language',
      tooltip: 'Switch interface language',
      current: 'Current language: {language}',
    },
    settings: {
      label: 'Settings',
      tooltip: 'Settings & data',
    },
    support: {
      label: 'Support',
      tooltip: 'Support this project',
    },
    fetch: {
      label: 'Fetch repositories',
      short: 'Fetch',
      tooltip: 'Load repositories from GitHub',
      loading: 'Fetching…',
    },
    menu: 'Menu',
  },

  hero: {
    eyebrow: '100% free · 100% client-side',
    title: 'Bind your GitHub work into a classic book',
    subtitle:
      'Sign in with your GitHub username, curate the repositories that matter, and compose them into a printable anthology. Everything runs in your browser — no server, no account, no tracking.',
    stats: {
      repos: 'Repositories',
      selected: 'In the book',
      chapters: 'Chapters',
      language: 'Language',
      connection: 'Connection',
    },
    connection: {
      anonymous: 'Public only',
      token: 'Token ready',
      user: 'as {username}',
    },
    steps: {
      title: 'Three steps to your anthology',
      first: 'Enter your GitHub username',
      second: 'Curate repos, statuses and summaries',
      third: 'Compose and print the book',
    },
  },

  library: {
    title: 'Repository manager',
    subtitle: 'Curate what goes into the book: visibility, project status and the description each chapter prints.',
    toolbar: {
      search: {
        label: 'Filter repositories',
        placeholder: 'Filter by name, description or language…',
      },
      sort: {
        label: 'Sort by',
        status: 'Status',
        updated: 'Last updated',
        name: 'Alphabetical (A–Z)',
      },
      hideForks: 'Hide forks',
      selectAll: 'Select all',
      selectNone: 'Select none',
      invert: 'Invert',
      refresh: 'Refresh repositories',
    },
    row: {
      include: 'Include in book',
      includeLabel: 'Include “{name}” in the book',
      openOnGithub: 'Repository',
      homepage: 'Live',
      docs: 'Docs',
      stars: '{count} stars',
      forks: '{count} forks',
      issues: '{count} open issues',
      updated: 'Updated {time}',
      noLicense: 'No license',
      topics: 'Topics',
      fork: 'Fork',
      private: 'Private',
      archived: 'Archived',
      disabled: 'Disabled',
      description: {
        label: 'Short book description',
        placeholder: 'Describe this project in a sentence or two…',
        hint: 'Printed in the book index. Pre-filled from your GitHub description.',
        reset: 'Reset to GitHub description',
        resetLabel: 'Reset the description of “{name}” to the GitHub text',
        counter: '{count} / 200',
        noSource: 'No description on GitHub yet.',
        edited: 'edited',
        auto: 'from GitHub',
      },
      status: {
        label: 'Project status',
        labelFor: 'Project status of “{name}”',
        auto: 'auto',
        manual: 'manual',
      },
    },
    empty: {
      fetch: {
        title: 'No repositories loaded yet',
        body: 'Enter your GitHub username in the settings or in the field below, then fetch your repositories to start curating your anthology.',
        cta: 'Open settings',
      },
      search: {
        title: 'Nothing matches your filters',
        body: 'Try a different search term, or show forks again.',
        cta: 'Clear filters',
      },
      username: {
        title: 'Who is the author?',
        body: 'GitBooklet needs a GitHub username to build your library.',
      },
    },
    quickFetch: {
      label: 'GitHub username',
      placeholder: 'e.g. AndrexTheDev',
      cta: 'Fetch repositories',
    },
    loading: {
      page: 'Fetching page {page}…',
      pageOf: 'Fetching page {page} of {totalPages}…',
      count: 'Loaded {count} repositories so far…',
    },
    counts: {
      repos: { one: '1 repository', other: '{count} repositories' },
      visible: { one: '1 in the book', other: '{count} in the book' },
      hidden: { one: '1 hidden', other: '{count} hidden' },
      forksHidden: { one: '1 fork hidden', other: '{count} forks hidden' },
    },
    fetchedAt: 'Synchronised {time}',
    neverFetched: 'Not synchronised yet',
    source: {
      user: 'via token · includes private',
      users: 'public only',
    },
  },
  status: {
    live: 'Live',
    development: 'In Development',
    beta: 'Beta / MVP',
    paused: 'Paused / Archived',
    hints: {
      live: 'Deployed and reachable — has a live homepage.',
      development: 'Actively worked on: updated within the last 30 days.',
      beta: 'Released but not deployed, or only touched occasionally.',
      paused: 'Archived, disabled or untouched for over a year.',
    },
    reasons: {
      topic: 'from topic “{detail}”',
      archived: 'archived on GitHub',
      disabled: 'disabled on GitHub',
      homepage: 'has a live homepage',
      recent: 'updated {time}',
      maintained: 'last updated {time}',
      dormant: 'untouched for {time}',
      unknown: 'no signal on GitHub',
      manual: 'set by you',
    },
  },
  summary: {
    title: 'Book preview',
    subtitle: 'This is what your anthology currently contains.',
    bookTitle: {
      label: 'Title',
      fallback: 'Untitled anthology',
    },
    author: {
      label: 'Author',
      fallback: 'Anonymous',
    },
    email: {
      label: 'Contact',
      fallback: 'not set',
    },
    edition: 'First edition · {year}',
    chapters: {
      title: 'Table of contents',
      empty: 'No chapters yet — include at least one repository.',
      entry: '{index}. {title}',
      more: { one: '1 more chapter', other: '{count} more chapters' },
    },
    stats: {
      chapters: 'Chapters',
      hidden: 'Hidden',
      languages: 'Languages',
      stars: 'Stars',
    },
    actions: {
      build: 'Compose book PDF',
      print: 'Print preview',
      editMeta: 'Edit book details',
    },
    build: {
      pending: 'The PDF composer is the next milestone — the shell, i18n and state layer are ready.',
      noChapters: 'Select at least one repository before composing the book.',
    },
    tip: 'Tip: statuses and summaries are stored per repository in your browser and survive a page reload.',
  },

  settings: {
    title: 'Settings',
    subtitle: 'Everything is stored locally in this browser. Nothing is uploaded.',
    done: 'Done',
    sections: {
      github: 'GitHub connection',
      book: 'Book details',
      language: 'Language',
      data: 'Data portability',
      security: 'Security',
    },
    username: {
      label: 'GitHub username',
      placeholder: 'e.g. AndrexTheDev',
      hint: 'The account whose public repositories are loaded.',
      invalid: 'That does not look like a valid GitHub username.',
    },
    token: {
      label: 'Personal Access Token',
      placeholder: 'ghp_… (leave empty for public repositories only)',
      hint: 'Only needed to include private repositories.',
      show: 'Show token',
      hide: 'Hide token',
      clear: 'Remove token',
      scopes: 'Required scope: {scopes}. A fine-grained token with read-only “Contents” and “Metadata” access works too.',
      docs: 'How to create a token',
      verify: 'Verify',
      verifying: 'Verifying…',
      valid: 'Connected as {login} · {plans}',
      validSimple: 'Connected as {login}',
      invalid: 'GitHub rejected this token.',
      stored: 'Stored on this device',
      empty: 'No token stored — public repositories only.',
      securityNote:
        'The token is obfuscated with a device key before it is written to localStorage, never sent anywhere except api.github.com, and removed when you clear local data. Obfuscation is not encryption: on a shared computer, prefer leaving the field empty.',
      removedOnExport: 'Exports omit the token unless you explicitly enable it below.',
    },
    bookTitle: {
      label: 'Book title',
      placeholder: 'My Software Engineering Anthology',
      hint: 'Printed on the cover page and in the PDF header.',
      reset: 'Restore default title',
    },
    authorName: {
      label: 'Author name',
      placeholder: 'AndrexTheDev',
      hint: 'Shown on the cover and in the colophon.',
    },
    authorEmail: {
      label: 'Author e-mail',
      placeholder: 'you@example.com',
      hint: 'Optional contact printed in the colophon.',
      invalid: 'That does not look like a valid e-mail address.',
    },
    language: {
      label: 'Interface language',
      hint: 'Switches every label instantly. Your choice is remembered.',
      auto: 'Detected from browser: {language}',
    },
    data: {
      export: 'Export settings (JSON)',
      exportHint: 'Downloads your configuration, repository overrides and book details.',
      exportSuccess: 'Settings exported.',
      exportIncludeToken: 'Include access token in the export',
      exportIncludeTokenWarning:
        'The token is written in plain text. Only enable this to move your settings to your own device.',
      import: 'Import settings (JSON)',
      importHint: 'Restores a previously exported configuration file.',
      importSuccess: 'Settings imported.',
      importInvalid: 'That file is not a valid GitBooklet configuration.',
      importEmpty: 'The file did not contain any settings.',
      importModeMerge: 'Merge into current settings',
      importModeHint: 'Unticked, an imported file replaces your current settings.',
      reset: 'Reset to defaults',
      resetHint: 'Restores default book details and clears repository overrides.',
      resetConfirm: 'Reset all settings to their defaults? Repository overrides will be lost.',
      resetSuccess: 'Settings reset to defaults.',
      clear: 'Clear local data',
      clearHint: 'Removes everything GitBooklet stored in this browser, including the token.',
      clearConfirm: 'Delete all locally stored GitBooklet data? This cannot be undone.',
      clearSuccess: 'Local data cleared.',
    },
    security: {
      title: 'Where your data lives',
      body: 'GitBooklet has no backend. Settings, tokens and overrides are kept in this browser’s localStorage and are exported only when you ask for it.',
      storageUsed: '{size} used in this browser',
      memoryOnly: 'Storage is blocked in this context — your settings will be lost when you close the tab.',
    },
    saved: 'Settings saved locally',
  },

  support: {
    title: 'Support GitBooklet',
    subtitle: 'Free software, real hosting costs.',
    intro:
      'GitBooklet is and stays free, with no ads and no accounts. If it saves you time, consider supporting the project — or simply star the repository, which costs nothing and helps more people find it.',
    crypto: {
      title: 'Crypto donation',
      hint: 'Send any amount to one of these addresses.',
      copy: 'Copy address',
      copied: 'Address copied to clipboard',
      network: 'Network: {network}',
      placeholder: 'Placeholder address — configure it in src/config/support.js',
      explorer: 'View on explorer',
    },
    links: {
      title: 'Other ways to help',
      star: 'Star the repository',
      starHint: 'Visibility is the cheapest form of support.',
      sponsor: 'GitHub Sponsors',
      sponsorHint: 'Recurring support through GitHub.',
      issue: 'Report an issue or idea',
      issueHint: 'Bug reports and feature requests shape the roadmap.',
      share: 'Tell a colleague',
    },
    free: {
      note: 'No paywall, no premium tier, no data selling. Ever.',
    },
  },

  errors: {
    network: 'Cannot reach GitHub. Check your connection and try again.',
    unauthorized: 'GitHub rejected the credentials. Check the username and token.',
    notFound: 'No GitHub user named “{username}” was found.',
    rateLimit: 'GitHub rate limit reached. Try again {time}.',
    forbidden: 'GitHub refused the request. The token may lack the “repo” scope.',
    server: 'GitHub returned an error ({status}). Please try again shortly.',
    unknown: 'Something went wrong while fetching repositories.',
    usernameRequired: 'Enter a GitHub username first.',
    invalidJson: 'The file could not be parsed as JSON.',
    clipboard: 'Copying to the clipboard failed.',
  },

  toasts: {
    fetch: {
      start: 'Fetching repositories for {username}…',
      success: { one: 'Loaded 1 repository', other: 'Loaded {count} repositories' },
      empty: '{username} has no visible repositories.',
      private: 'Private repositories need a personal access token.',
      publicOnly: 'Public repositories only — add a token in Settings to include private ones.',
      truncated: 'Loaded {count} repositories and stopped at the {pages}-page safety limit. Some may be missing.',
    },
    language: {
      changed: 'Interface language: {language}',
    },
    clipboard: {
      copied: 'Copied to clipboard',
    },
    repos: {
      allVisible: 'All repositories added to the book.',
      noneVisible: 'All repositories removed from the book.',
      restored: 'Filters cleared.',
    },
  },

  footer: {
    privacy: 'No backend. No cookies. No tracking.',
    built: 'Built for the browser by {author}.',
    license: 'MIT licensed',
    version: 'Version {version}',
    source: 'Source code',
    storage: 'Local storage: {size}',
  },
};
