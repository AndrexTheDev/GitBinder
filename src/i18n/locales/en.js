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
    title: 'GitBinder — Your GitHub portfolio as a classic book',
    tagline: 'Turn your repositories into a printable Classic Book.',
    description:
      'GitBinder is a free, client-side tool that composes your GitHub repositories into a book-like PDF portfolio. Nothing leaves your browser except the requests you trigger yourself.',
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
      name: 'GitBinder',
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
      notes: {
        label: 'Personal notes',
        labelFor: 'Personal notes for “{name}”',
        placeholder: 'Your own notes about this project…',
        hint: 'Printed with the project as a writable block. Yours alone — a re-fetch never touches these notes.',
        counter: '{count} / 600',
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
        body: 'GitBinder needs a GitHub username to build your library.',
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
      print: 'Print book / Save as PDF',
      editMeta: 'Edit book details',
    },
    build: {
      ready: 'The preview renders the real book at A4 size — every link stays clickable in the PDF.',
      noChapters: 'Select at least one repository before composing the book.',
    },
    tip: 'Tip: statuses and summaries are stored per repository in your browser and survive a page reload.',
  },

  book: {
    bar: {
      title: 'Book studio',
      hide: 'Hide preview',
      preview: 'Live PDF book preview',
      generate: 'Generate PDF / Print book',
      pages: { one: '{count} page', other: '{count} pages' },
      chapters: { one: '{count} chapter', other: '{count} chapters' },
      built: 'Book composed — {pages} pages are ready to print.',
    },
    cover: {
      subtitle: 'Project & Codebase Anthology',
      byline: 'by',
      bioFallback:
        'A curated selection of public repositories — built, shipped and maintained in the open.',
      generatedOn: 'Generated on {date}',
      stats: '{projects} projects · {languages} languages · {stars} stars',
    },
    toc: {
      title: 'Table of contents',
      continued: 'Table of contents (continued)',
      groupContinued: '{group} (continued)',
      pageLabel: 'Page {page}',
      empty: 'No projects selected yet — include at least one repository in the library above.',
    },
    entry: {
      chapter: 'Chapter {index}',
      stars: 'Stars',
      forks: 'Forks',
      updated: 'Last updated',
      license: 'Licence',
      repository: 'GitHub repository',
      homepage: 'Live site & docs',
      noDescription: 'No description was provided for this project.',
      notes: 'Notes',
      notesHint: 'Space for your own notes — write on the printout or fill it in with a PDF editor.',
      forkNote: 'Fork',
      archivedNote: 'Archived',
    },
    runner: {
      author: 'Author: {name}',
      attribution: 'Generated with GitBinder',
    },
    pageLabel: 'Page {page}',
    print: {
      empty: 'Your book has no chapters yet — include at least one repository first.',
      ready: 'Opening the print dialog — choose “Save as PDF” to keep the book.',
    },
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
    authorBio: {
      label: 'Author bio',
      placeholder: 'A short paragraph printed under your name on the cover',
      hint: 'Optional. Printed on the cover page; leave empty for the default line.',
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
      importInvalid: 'That file is not a valid GitBinder configuration.',
      importEmpty: 'The file did not contain any settings.',
      importModeMerge: 'Merge into current settings',
      importModeHint: 'Unticked, an imported file replaces your current settings.',
      reset: 'Reset to defaults',
      resetHint: 'Restores default book details and clears repository overrides.',
      resetConfirm: 'Reset all settings to their defaults? Repository overrides will be lost.',
      resetSuccess: 'Settings reset to defaults.',
      clear: 'Clear local data',
      clearHint: 'Removes everything GitBinder stored in this browser, including the token.',
      clearConfirm: 'Delete all locally stored GitBinder data? This cannot be undone.',
      clearSuccess: 'Local data cleared.',
    },
    security: {
      title: 'Where your data lives',
      body: 'GitBinder has no backend. Settings, tokens and overrides are kept in this browser’s localStorage and are exported only when you ask for it.',
      storageUsed: '{size} used in this browser',
      memoryOnly: 'Storage is blocked in this context — your settings will be lost when you close the tab.',
    },
    saved: 'Settings saved locally',
  },

  support: {
    title: 'Support GitBinder',
    subtitle: 'Free software, real hosting costs.',
    intro:
      'GitBinder is and stays free, with no ads and no accounts. If it saves you time, consider supporting the project — or simply star the repository, which costs nothing and helps more people find it.',
    crypto: {
      title: 'Crypto donation',
      hint: 'Send any amount to one of these addresses.',
      copy: 'Copy address',
      copied: 'Address copied to clipboard',
      network: 'Network: {network}',
      placeholder: 'Placeholder address — configure it in src/config/support.js',
      explorer: 'View on explorer',
      qrLabel: 'QR code for the {coin} donation address',
      tablist: 'Choose a cryptocurrency',
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

  info: {
    help: {
      footerLink: 'Help',
      title: 'How GitBinder works',
      subtitle: 'From your GitHub account to a printed book in three steps.',
      tip: 'Your curation lives in this browser only. Reload the page and it is still here; clear the site data and it is gone for good.',
      steps: {
        connect: {
          title: 'Enter your GitHub username',
          body:
            'Type your username and fetch your repositories. A Personal Access Token is optional and only needed if you want to include private repositories.',
        },
        curate: {
          title: 'Curate descriptions and status',
          body:
            'Choose which projects make it into the book, correct the status GitBinder detected, and rewrite the short description that gets printed. Forks are left out by default.',
        },
        print: {
          title: 'Compose and export your PDF',
          body:
            'Open the live preview to see the real book at A4 size, then choose “Generate PDF / Print book” and pick “Save as PDF” in the print dialog.',
        },
      },
    },
    disclaimer: {
      footerLink: 'Disclaimer',
      title: 'Disclaimer',
      subtitle: 'What GitBinder does — and does not do — with your data.',
      intro:
        'GitBinder operates 100% client-side. Your Personal Access Token and your data never leave your browser.',
      sections: {
        clientSide: {
          title: 'No backend, no telemetry',
          body:
            'The app is a static site. There is no server that could log your requests, and the tool contains no analytics, no cookies and no tracking of any kind.',
        },
        token: {
          title: 'Your Personal Access Token',
          body:
            'A token you enter is used solely to call api.github.com from your own browser. It is obfuscated with a device key before being written to local storage — which is not the same as encryption. On a shared computer, leave the field empty.',
        },
        noWarranty: {
          title: 'No warranty',
          body:
            'GitBinder is provided “as is”. Repository data is fetched live from GitHub and can be incomplete, out of date or wrong. Check the generated book before you rely on it.',
        },
        donations: {
          title: 'Donations',
          body:
            'Crypto donations are voluntary and non-refundable. Always check the address shown on screen before sending — blockchain transactions cannot be reversed.',
        },
        thirdParty: {
          title: 'Third-party content',
          body:
            'Project names, descriptions and links belong to their respective owners and are shown exactly as the GitHub API returns them. GitBinder is not affiliated with GitHub, Inc.',
        },
      },
    },
    terms: {
      footerLink: 'Terms',
      title: 'Terms of service',
      subtitle: 'Short terms for a small open-source tool.',
      intro:
        'These terms are deliberately short. GitBinder is a free static web app with no accounts and no server, so there is not much to regulate.',
      sections: {
        scope: {
          title: 'Scope of the service',
          body:
            'GitBinder is offered free of charge and may be changed or discontinued at any time. There is no entitlement to availability, support or any particular feature.',
        },
        noAccount: {
          title: 'No account, nothing is sold',
          body:
            'Nothing is sold and no account is created. Because no personal data is transmitted to us, using the tool requires no data-processing agreement.',
        },
        yourData: {
          title: 'Your data stays yours',
          body:
            'Everything you type — book title, author name, descriptions, token — is stored in your browser only. You can export it as JSON or delete it at any time in Settings.',
        },
        noWarranty: {
          title: 'Warranty and liability',
          body:
            'Liability is limited to intent and gross negligence. In particular we accept no liability for the content of generated PDFs, which is produced from the data you selected and edited.',
        },
        openSource: {
          title: 'Open source',
          body:
            'GitBinder is released under the MIT licence. You may use, modify and self-host it, including commercially, within the terms of that licence.',
        },
        changes: {
          title: 'Changes to these terms',
          body:
            'We may update these terms. The version published with the app applies; continuing to use it after a change counts as acceptance.',
        },
      },
    },
    contact: {
      footerLink: 'Contact',
      title: 'Contact',
      subtitle: 'Questions, bug reports and ideas are welcome.',
      intro: '{app} is developed by {author}. The quickest way to reach me is by e-mail.',
      github: 'GitHub profile',
      githubHint: 'Source code, releases and other projects.',
      issue: 'Report an issue',
      issueHint: 'Bugs and feature requests belong in the issue tracker.',
      support: 'Support the project',
      supportHint: 'Star the repository or donate — both keep it alive.',
      noSupport:
        'This is a spare-time project: there is no paid support and no guaranteed response time. Please never send personal data or credentials by e-mail.',
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
    support: 'Support the project',
    storage: 'Local storage: {size}',
  },
};
