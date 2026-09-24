/**
 * German dictionary.
 *
 * Key parity with `en.js` is mandatory and verified by `tests/i18n.test.js`.
 * Address form: informal “du” — consistent with developer tooling in DACH.
 */
export default {
  meta: {
    title: 'GitBinder — Dein GitHub-Portfolio als klassisches Buch',
    tagline: 'Verwandle deine Repositories in ein druckbares Buch.',
    description:
      'GitBinder ist ein kostenloses Client-side-Werkzeug, das deine GitHub-Repositories zu einem buchähnlichen PDF-Portfolio zusammenfügt. Nichts verlässt deinen Browser außer den Anfragen, die du selbst auslöst.',
  },

  common: {
    save: 'Speichern',
    cancel: 'Abbrechen',
    close: 'Schließen',
    confirm: 'Bestätigen',
    delete: 'Löschen',
    remove: 'Entfernen',
    reset: 'Zurücksetzen',
    retry: 'Erneut versuchen',
    copy: 'Kopieren',
    copied: 'Kopiert',
    loading: 'Wird geladen …',
    search: 'Suchen',
    all: 'Alle',
    none: 'Keine',
    optional: 'optional',
    required: 'erforderlich',
    yes: 'Ja',
    no: 'Nein',
    apply: 'Anwenden',
    back: 'Zurück',
    unknown: 'Unbekannt',
    never: 'nie',
    enabled: 'Aktiviert',
    disabled: 'Deaktiviert',
    characters: '{count} Zeichen',
    showing: '{shown} von {total} angezeigt',
  },

  a11y: {
    skipToContent: 'Zum Inhalt springen',
    mainNavigation: 'Hauptnavigation',
    languageSwitch: 'Sprache der Oberfläche',
    toastRegion: 'Benachrichtigungen',
    repositoryList: 'Repository-Liste',
    bookSummary: 'Buchübersicht',
    closeDialog: 'Dialog schließen',
    openSupport: 'Support-Dialog öffnen',
    openSettings: 'Einstellungen öffnen',
    togglePassword: 'Access-Token ein- oder ausblenden',
  },

  nav: {
    brand: {
      name: 'GitBinder',
      tagline: 'Deine Repositories, gebunden als Buch',
    },
    language: {
      label: 'Sprache',
      tooltip: 'Sprache der Oberfläche wechseln',
      current: 'Aktuelle Sprache: {language}',
    },
    settings: {
      label: 'Einstellungen',
      tooltip: 'Einstellungen & Daten',
    },
    support: {
      label: 'Unterstützen',
      tooltip: 'Dieses Projekt unterstützen',
    },
    fetch: {
      label: 'Repositories laden',
      short: 'Laden',
      tooltip: 'Repositories von GitHub laden',
      loading: 'Wird geladen …',
    },
    menu: 'Menü',
  },

  hero: {
    eyebrow: '100 % kostenlos · 100 % client-side',
    title: 'Binde deine GitHub-Arbeit zu einem klassischen Buch',
    subtitle:
      'Melde dich mit deinem GitHub-Benutzernamen an, kuratiere die wichtigen Repositories und füge sie zu einer druckbaren Anthologie zusammen. Alles läuft in deinem Browser — kein Server, kein Konto, kein Tracking.',
    stats: {
      repos: 'Repositories',
      selected: 'Im Buch',
      chapters: 'Kapitel',
      language: 'Sprache',
      connection: 'Verbindung',
    },
    connection: {
      anonymous: 'Nur öffentlich',
      token: 'Token bereit',
      user: 'als {username}',
    },
    steps: {
      title: 'In drei Schritten zur Anthologie',
      first: 'GitHub-Benutzernamen eingeben',
      second: 'Repositories, Status und Kurzfassungen festlegen',
      third: 'Buch zusammenstellen und drucken',
    },
  },

  library: {
    title: 'Repository-Verwaltung',
    subtitle: 'Entscheide, was ins Buch kommt: Sichtbarkeit, Projektstatus und die Beschreibung, die jedes Kapitel druckt.',
    toolbar: {
      search: {
        label: 'Repositories filtern',
        placeholder: 'Nach Name, Beschreibung oder Sprache filtern …',
      },
      sort: {
        label: 'Sortieren nach',
        status: 'Status',
        updated: 'Zuletzt aktualisiert',
        name: 'Alphabetisch (A–Z)',
      },
      hideForks: 'Forks ausblenden',
      selectAll: 'Alle auswählen',
      selectNone: 'Keine auswählen',
      invert: 'Auswahl umkehren',
      refresh: 'Repositories neu laden',
    },
    row: {
      include: 'Ins Buch',
      includeLabel: '„{name}“ ins Buch aufnehmen',
      openOnGithub: 'Repository',
      homepage: 'Live',
      docs: 'Doku',
      stars: '{count} Stars',
      forks: '{count} Forks',
      issues: '{count} offene Issues',
      updated: 'Aktualisiert {time}',
      noLicense: 'Keine Lizenz',
      topics: 'Themen',
      fork: 'Fork',
      private: 'Privat',
      archived: 'Archiviert',
      disabled: 'Deaktiviert',
      description: {
        label: 'Kurze Buchbeschreibung',
        placeholder: 'Beschreibe dieses Projekt in ein oder zwei Sätzen …',
        hint: 'Erscheint im Buchverzeichnis. Vorausgefüllt mit deiner GitHub-Beschreibung.',
        reset: 'Auf GitHub-Beschreibung zurücksetzen',
        resetLabel: 'Beschreibung von „{name}“ auf den GitHub-Text zurücksetzen',
        counter: '{count} / 200',
        noSource: 'Noch keine Beschreibung auf GitHub.',
        edited: 'bearbeitet',
        auto: 'von GitHub',
      },
      notes: {
        label: 'Persönliche Notizen',
        labelFor: 'Persönliche Notizen zu „{name}“',
        placeholder: 'Deine eigenen Notizen zu diesem Projekt…',
        hint: 'Wird als beschreibbarer Block mitgedruckt. Ganz allein deine — ein erneutes Laden überschreibt diese Notizen nie.',
        counter: '{count} / 600',
      },
      status: {
        label: 'Projektstatus',
        labelFor: 'Projektstatus von „{name}“',
        auto: 'automatisch',
        manual: 'manuell',
      },
    },
    empty: {
      fetch: {
        title: 'Noch keine Repositories geladen',
        body: 'Trage deinen GitHub-Benutzernamen in den Einstellungen oder im Feld unten ein und lade anschließend deine Repositories, um mit der Kuratierung zu beginnen.',
        cta: 'Einstellungen öffnen',
      },
      search: {
        title: 'Keine Treffer für diese Filter',
        body: 'Versuche einen anderen Suchbegriff oder blende Forks wieder ein.',
        cta: 'Filter zurücksetzen',
      },
      username: {
        title: 'Wer ist die Autorin oder der Autor?',
        body: 'GitBinder benötigt einen GitHub-Benutzernamen, um deine Bibliothek aufzubauen.',
      },
    },
    quickFetch: {
      label: 'GitHub-Benutzername',
      placeholder: 'z. B. AndrexTheDev',
      cta: 'Repositories laden',
    },
    loading: {
      page: 'Lade Seite {page} …',
      pageOf: 'Lade Seite {page} von {totalPages} …',
      count: 'Bisher {count} Repositories geladen …',
    },
    counts: {
      repos: { one: '1 Repository', other: '{count} Repositories' },
      visible: { one: '1 im Buch', other: '{count} im Buch' },
      hidden: { one: '1 ausgeblendet', other: '{count} ausgeblendet' },
      forksHidden: { one: '1 Fork ausgeblendet', other: '{count} Forks ausgeblendet' },
    },
    fetchedAt: 'Synchronisiert {time}',
    neverFetched: 'Noch nicht synchronisiert',
    source: {
      user: 'per Token · inklusive privater',
      users: 'nur öffentliche',
    },
  },
  status: {
    live: 'Live',
    development: 'In Entwicklung',
    beta: 'Beta / MVP',
    paused: 'Pausiert / Archiviert',
    hints: {
      live: 'Ausgerollt und erreichbar — hat eine Live-Webseite.',
      development: 'Wird aktiv bearbeitet: in den letzten 30 Tagen aktualisiert.',
      beta: 'Veröffentlicht, aber nicht ausgerollt — oder nur gelegentlich angefasst.',
      paused: 'Archiviert, deaktiviert oder seit über einem Jahr unberührt.',
    },
    reasons: {
      topic: 'aus Topic „{detail}“',
      archived: 'auf GitHub archiviert',
      disabled: 'auf GitHub deaktiviert',
      homepage: 'hat eine Live-Webseite',
      recent: 'aktualisiert {time}',
      maintained: 'zuletzt aktualisiert {time}',
      dormant: 'seit {time} unberührt',
      unknown: 'kein Signal auf GitHub',
      manual: 'von dir festgelegt',
    },
  },
  summary: {
    title: 'Buchvorschau',
    subtitle: 'Das enthält deine Anthologie derzeit.',
    bookTitle: {
      label: 'Titel',
      fallback: 'Anthologie ohne Titel',
    },
    author: {
      label: 'Autor',
      fallback: 'Anonym',
    },
    email: {
      label: 'Kontakt',
      fallback: 'nicht angegeben',
    },
    edition: 'Erste Ausgabe · {year}',
    chapters: {
      title: 'Inhaltsverzeichnis',
      empty: 'Noch keine Kapitel — nimm mindestens ein Repository auf.',
      entry: '{index}. {title}',
      more: { one: '1 weiteres Kapitel', other: '{count} weitere Kapitel' },
    },
    stats: {
      chapters: 'Kapitel',
      hidden: 'Ausgeblendet',
      languages: 'Sprachen',
      stars: 'Stars',
    },
    actions: {
      build: 'Buch-PDF zusammenstellen',
      print: 'Buch drucken / Als PDF sichern',
      editMeta: 'Buchdetails bearbeiten',
    },
    build: {
      ready:
        'Die Vorschau zeigt das echte Buch in A4-Größe — alle Links bleiben im PDF klickbar.',
      noChapters: 'Wähle mindestens ein Repository aus, bevor du das Buch zusammenstellst.',
    },
    tip: 'Tipp: Status und Kurzbeschreibungen werden pro Repository im Browser gespeichert und überleben einen Neuladen der Seite.',
  },

  book: {
    picker: {
      button: 'Projekte',
      title: 'Projekte in diesem Buch',
      all: 'Alle Projekte aufnehmen',
      none: 'Kein Projekt aufnehmen',
      empty: 'Lade zuerst deine Repositories — es gibt noch nichts auszuwählen.',
    },
    bar: {
      title: 'Buchwerkstatt',
      hide: 'Vorschau ausblenden',
      preview: 'Live-PDF-Vorschau',
      generate: 'PDF erzeugen / Buch drucken',
      pages: { one: '{count} Seite', other: '{count} Seiten' },
      chapters: { one: '{count} Kapitel', other: '{count} Kapitel' },
      built: 'Buch zusammengestellt — {pages} Seiten sind bereit zum Druck.',
    },
    cover: {
      subtitle: 'Projekt- & Codebase-Anthologie',
      byline: 'von',
      bioFallback:
        'Eine kuratierte Auswahl öffentlicher Repositories — offen gebaut, ausgeliefert und gepflegt.',
      generatedOn: 'Erstellt am {date}',
      fallbackTitle: 'Ausgewählte Arbeiten',
      fallbackAuthor: 'AndrexTheDev',
      stats: '{projects} Projekte · {languages} Sprachen · {stars} Sterne',
    },
    toc: {
      title: 'Inhaltsverzeichnis',
      continued: 'Inhaltsverzeichnis (Fortsetzung)',
      groupContinued: '{group} (Fortsetzung)',
      pageLabel: 'Seite {page}',
      empty: 'Noch keine Projekte ausgewählt — nimm oben mindestens ein Repository auf.',
    },
    entry: {
      chapter: 'Kapitel {index}',
      stars: 'Sterne',
      forks: 'Forks',
      updated: 'Zuletzt aktualisiert',
      license: 'Lizenz',
      repository: 'GitHub-Repository',
      homepage: 'Live-Site & Dokumentation',
      noDescription: 'Für dieses Projekt wurde keine Beschreibung hinterlegt.',
      notes: 'Notizen',
      notesHint: 'Platz für deine eigenen Notizen — auf dem Ausdruck beschreiben oder im PDF-Programm ausfüllen.',
      language: 'Sprache',
      status: 'Status',
      description: 'Beschreibung',      forkNote: 'Fork',
      archivedNote: 'Archiviert',
    },
    runner: {
      author: 'Autor: {name}',
      attribution: 'Generated with {app}',
    },
    pageLabel: 'Seite {page}',
    print: {
      empty: 'Dein Buch hat noch keine Kapitel — nimm zuerst mindestens ein Repository auf.',
      ready: 'Druckdialog wird geöffnet — wähle „Als PDF sichern“, um das Buch zu behalten.',
    },
  },
  settings: {
    title: 'Einstellungen',
    subtitle: 'Alles wird lokal in diesem Browser gespeichert. Nichts wird hochgeladen.',
    done: 'Fertig',
    sections: {
      github: 'GitHub-Verbindung',
      book: 'Buchdetails',
      language: 'Sprache',
      data: 'Datenübertragbarkeit',
      security: 'Sicherheit',
    },
    username: {
      label: 'GitHub-Benutzername',
      placeholder: 'z. B. AndrexTheDev',
      hint: 'Das Konto, dessen öffentliche Repositories geladen werden.',
      invalid: 'Das sieht nicht nach einem gültigen GitHub-Benutzernamen aus.',
    },
    token: {
      label: 'Personal Access Token',
      placeholder: 'ghp_… (leer lassen für nur öffentliche Repositories)',
      hint: 'Nur nötig, um private Repositories aufzunehmen.',
      show: 'Token anzeigen',
      hide: 'Token ausblenden',
      clear: 'Token entfernen',
      scopes: 'Benötigter Scope: {scopes}. Ein feingranulares Token mit lesendem Zugriff auf „Contents“ und „Metadata“ funktioniert ebenfalls.',
      docs: 'So erstellst du ein Token',
      verify: 'Prüfen',
      verifying: 'Wird geprüft …',
      valid: 'Verbunden als {login} · {plans}',
      validSimple: 'Verbunden als {login}',
      invalid: 'GitHub hat dieses Token abgelehnt.',
      stored: 'Auf diesem Gerät gespeichert',
      empty: 'Kein Token gespeichert — nur öffentliche Repositories.',
      securityNote:
        'Das Token wird vor dem Schreiben in den localStorage mit einem Geräteschlüssel verschleiert, ausschließlich an api.github.com gesendet und beim Löschen der lokalen Daten entfernt. Verschleierung ist keine Verschlüsselung: Lass das Feld auf gemeinsamen Rechnern lieber leer.',
      removedOnExport: 'Exporte lassen das Token weg, sofern du es unten nicht ausdrücklich aktivierst.',
    },
    bookTitle: {
      label: 'Buchtitel',
      placeholder: 'My Software Engineering Anthology',
      hint: 'Erscheint auf der Titelseite und in der PDF-Kopfzeile.',
      reset: 'Standardtitel wiederherstellen',
    },
    authorName: {
      label: 'Name des Autors',
      placeholder: 'AndrexTheDev',
      hint: 'Steht auf dem Cover und im Kolophon.',
    },
    authorEmail: {
      label: 'E-Mail des Autors',
      placeholder: 'du@beispiel.de',
      hint: 'Optionale Kontaktangabe im Kolophon.',
      invalid: 'Das sieht nicht nach einer gültigen E-Mail-Adresse aus.',
    },
    authorBio: {
      label: 'Kurzbiografie',
      placeholder: 'Ein kurzer Absatz, der auf dem Cover unter deinem Namen steht',
      hint: 'Optional. Erscheint auf dem Cover; leer lassen für die Standardzeile.',
    },
    language: {
      label: 'Sprache der Oberfläche',
      hint: 'Wechselt alle Beschriftungen sofort. Deine Wahl wird gespeichert.',
      auto: 'Aus dem Browser erkannt: {language}',
    },
    data: {
      export: 'Einstellungen exportieren (JSON)',
      exportHint: 'Lädt Konfiguration, Repository-Overrides und Buchdetails herunter.',
      exportSuccess: 'Einstellungen exportiert.',
      exportIncludeToken: 'Access-Token in den Export aufnehmen',
      exportIncludeTokenWarning:
        'Das Token wird im Klartext geschrieben. Aktiviere das nur, um deine Einstellungen auf dein eigenes Gerät zu übertragen.',
      import: 'Einstellungen importieren (JSON)',
      importHint: 'Stellt eine zuvor exportierte Konfigurationsdatei wieder her.',
      importSuccess: 'Einstellungen importiert.',
      importInvalid: 'Diese Datei ist keine gültige GitBinder-Konfiguration.',
      importEmpty: 'Die Datei enthielt keine Einstellungen.',
      importModeMerge: 'Mit aktuellen Einstellungen zusammenführen',
      importModeHint: 'Ohne Häkchen ersetzt eine importierte Datei deine aktuellen Einstellungen.',
      reset: 'Auf Standardwerte zurücksetzen',
      resetHint: 'Stellt die Standard-Buchdetails wieder her und löscht Repository-Overrides.',
      resetConfirm: 'Alle Einstellungen auf die Standardwerte zurücksetzen? Repository-Overrides gehen dabei verloren.',
      resetSuccess: 'Einstellungen auf Standardwerte zurückgesetzt.',
      clear: 'Lokale Daten löschen',
      clearHint: 'Entfernt alles, was GitBinder in diesem Browser gespeichert hat — inklusive Token.',
      clearConfirm: 'Alle lokal gespeicherten GitBinder-Daten löschen? Das kann nicht rückgängig gemacht werden.',
      clearSuccess: 'Lokale Daten gelöscht.',
    },
    security: {
      title: 'Wo deine Daten liegen',
      body: 'GitBinder hat kein Backend. Einstellungen, Token und Overrides bleiben im localStorage dieses Browsers und werden nur exportiert, wenn du es anforderst.',
      storageUsed: '{size} in diesem Browser belegt',
      memoryOnly: 'Speicher ist in diesem Kontext blockiert — deine Einstellungen gehen beim Schließen des Tabs verloren.',
    },
    saved: 'Einstellungen lokal gespeichert',
  },

  support: {
    title: 'GitBinder unterstützen',
    subtitle: 'Freie Software, echte Hosting-Kosten.',
    intro:
      'GitBinder ist und bleibt kostenlos, ohne Werbung und ohne Konten. Wenn es dir Zeit spart, unterstütze das Projekt gern — oder vergib einfach einen Stern für das Repository. Das kostet nichts und hilft anderen, es zu finden.',
    crypto: {
      title: 'Krypto-Spende',
      hint: 'Sende einen beliebigen Betrag an eine dieser Adressen.',
      copy: 'Adresse kopieren',
      copied: 'Adresse in die Zwischenablage kopiert',
      network: 'Netzwerk: {network}',
      placeholder: 'Platzhalter-Adresse — in src/config/support.js konfigurieren',
      explorer: 'Im Explorer ansehen',
      qrLabel: 'QR-Code für die {coin}-Spendenadresse',
      tablist: 'Kryptowährung wählen',
    },
    links: {
      title: 'Weitere Möglichkeiten',
      star: 'Repository mit einem Stern versehen',
      starHint: 'Sichtbarkeit ist die günstigste Form der Unterstützung.',
      sponsor: 'GitHub Sponsors',
      sponsorHint: 'Laufende Unterstützung über GitHub.',
      issue: 'Fehler oder Idee melden',
      issueHint: 'Fehlerberichte und Wünsche prägen die Roadmap.',
      share: 'Erzähl es einer Kollegin oder einem Kollegen',
    },
    free: {
      note: 'Keine Paywall, keine Premium-Stufe, kein Datenverkauf. Niemals.',
    },
  },

  info: {
    help: {
      footerLink: 'Hilfe',
      title: 'So funktioniert GitBinder',
      subtitle: 'In drei Schritten vom GitHub-Konto zum gedruckten Buch.',
      tip: 'Deine Auswahl wird ausschließlich in diesem Browser gespeichert. Nach dem Neuladen ist sie noch da — löschst du die Website-Daten, ist sie endgültig weg.',
      steps: {
        connect: {
          title: 'GitHub-Benutzernamen eingeben',
          body:
            'Gib deinen Benutzernamen ein und lade deine Repositories. Ein Personal Access Token ist optional und nur nötig, wenn private Repositories enthalten sein sollen.',
        },
        curate: {
          title: 'Beschreibungen und Status pflegen',
          body:
            'Wähle die Projekte für dein Buch, korrigiere den erkannten Status und formuliere die Kurzbeschreibung, die gedruckt wird. Forks sind standardmäßig ausgeschlossen.',
        },
        print: {
          title: 'Buch zusammenstellen und PDF exportieren',
          body:
            'Öffne die Live-Vorschau, um das echte Buch in A4-Größe zu sehen, wähle dann „PDF erzeugen / Buch drucken“ und im Druckdialog „Als PDF sichern“.',
        },
      },
    },
    disclaimer: {
      footerLink: 'Haftungsausschluss',
      title: 'Haftungsausschluss',
      subtitle: 'Was GitBinder mit deinen Daten tut — und was nicht.',
      intro:
        'GitBinder arbeitet zu 100 % client-side. Dein Personal Access Token und deine Daten verlassen deinen Browser nicht.',
      sections: {
        clientSide: {
          title: 'Kein Backend, keine Telemetrie',
          body:
            'Die Anwendung ist eine statische Website. Es gibt keinen Server, der deine Anfragen protokollieren könnte, und das Tool enthält keinerlei Analyse-, Cookie- oder Tracking-Funktionen.',
        },
        token: {
          title: 'Dein Personal Access Token',
          body:
            'Ein eingegebenes Token wird ausschließlich verwendet, um api.github.com aus deinem eigenen Browser aufzurufen. Vor dem Speichern wird es mit einem gerätespezifischen Schlüssel verschleiert — das ist keine Verschlüsselung. Auf einem gemeinsam genutzten Rechner: Feld leer lassen.',
        },
        noWarranty: {
          title: 'Keine Gewähr',
          body:
            'GitBinder wird „wie besehen“ bereitgestellt. Repository-Daten werden live von GitHub geladen und können unvollständig, veraltet oder fehlerhaft sein. Prüfe das erzeugte Buch, bevor du dich darauf verlässt.',
        },
        donations: {
          title: 'Spenden',
          body:
            'Krypto-Spenden sind freiwillig und nicht erstattungsfähig. Prüfe die angezeigte Adresse vor dem Senden — Blockchain-Transaktionen lassen sich nicht rückgängig machen.',
        },
        thirdParty: {
          title: 'Inhalte Dritter',
          body:
            'Projektnamen, Beschreibungen und Links gehören den jeweiligen Inhabern und werden so angezeigt, wie die GitHub-API sie liefert. GitBinder steht in keiner Verbindung zur GitHub, Inc.',
        },
      },
    },
    terms: {
      footerLink: 'AGB',
      title: 'Nutzungsbedingungen',
      subtitle: 'Kurze Bedingungen für ein kleines Open-Source-Werkzeug.',
      intro:
        'Diese Bedingungen sind bewusst kurz. GitBinder ist eine kostenlose statische Webanwendung ohne Konten und ohne Server — viel zu regeln gibt es nicht.',
      sections: {
        scope: {
          title: 'Umfang des Angebots',
          body:
            'GitBinder wird kostenlos bereitgestellt und kann jederzeit geändert oder eingestellt werden. Ein Anspruch auf Verfügbarkeit, Support oder bestimmte Funktionen besteht nicht.',
        },
        noAccount: {
          title: 'Kein Konto, kein Kaufvertrag',
          body:
            'Es wird nichts verkauft und kein Konto angelegt. Da keine personenbezogenen Daten an uns übertragen werden, ist für die Nutzung kein Vertrag zur Datenverarbeitung erforderlich.',
        },
        yourData: {
          title: 'Deine Daten bleiben deine',
          body:
            'Alles, was du eingibst — Buchtitel, Autorenname, Beschreibungen, Token — wird ausschließlich in deinem Browser gespeichert. Du kannst es in den Einstellungen jederzeit als JSON exportieren oder löschen.',
        },
        noWarranty: {
          title: 'Gewährleistung und Haftung',
          body:
            'Die Haftung beschränkt sich auf Vorsatz und grobe Fahrlässigkeit. Insbesondere übernehmen wir keine Haftung für den Inhalt erzeugter PDFs, der aus den von dir ausgewählten und bearbeiteten Daten entsteht.',
        },
        openSource: {
          title: 'Open Source',
          body:
            'GitBinder steht unter der MIT-Lizenz. Du darfst es — auch kommerziell — nutzen, verändern und selbst hosten, im Rahmen dieser Lizenz.',
        },
        changes: {
          title: 'Änderungen dieser Bedingungen',
          body:
            'Wir können diese Bedingungen anpassen. Es gilt die mit der Anwendung veröffentlichte Fassung. Die weitere Nutzung nach einer Änderung gilt als Zustimmung.',
        },
      },
    },
    contact: {
      footerLink: 'Kontakt',
      title: 'Kontakt',
      subtitle: 'Fragen, Fehlermeldungen und Ideen sind willkommen.',
      intro: '{app} wird von {author} entwickelt. Am schnellsten erreichst du mich per E-Mail.',
      github: 'GitHub-Profil',
      githubHint: 'Quellcode, Releases und weitere Projekte.',
      issue: 'Fehler melden',
      issueHint: 'Fehlerberichte und Funktionswünsche gehören in den Issue-Tracker.',
      support: 'Projekt unterstützen',
      supportHint: 'Stern vergeben oder spenden — beides hält es am Leben.',
      noSupport:
        'Dies ist ein Freizeitprojekt: Es gibt keinen bezahlten Support und keine garantierte Reaktionszeit. Bitte sende niemals persönliche Daten oder Zugangsdaten per E-Mail.',
    },
  },
  export: {
    title: 'Als Text exportieren',
    hint: 'Markdown für README oder Wiki, Klartext überall lesbar, CSV für die Tabellenkalkulation.',
    markdown: 'Markdown',
    text: 'Klartext',
    csv: 'CSV',
    empty: 'Nimm mindestens ein Repository auf, bevor du exportierst.',
    done: '{format} exportiert.',
    links: 'Links',
    columns: {
      chapter: 'Kapitel',
      project: 'Projekt',
      slug: 'Slug',
      license: 'Lizenz',
      description: 'Beschreibung',
      repository: 'Repository-URL',
      homepage: 'Homepage',
    },
  },
  adblock: {
    title: '{app} wird gerade ausgeblendet',
    lead: 'In diesem Browser ist ein Adblocker aktiv, deshalb steht die Oberfläche nicht zur Verfügung.',
    body: 'GitBinder zeigt selbst keine Werbung — die Oberfläche wird jedoch ausgeblendet, sobald ein Content-Blocker läuft. Gib diese Seite bitte frei und fahre dann fort.',
    step1: 'Öffne das Menü deines Adblockers für diese Seite.',
    step2: 'Schalte ihn aus oder füge eine Ausnahme für diese Adresse hinzu.',
    step3: 'Komm zurück und klicke auf „Erneut prüfen“.',
    checking: 'Wird geprüft…',
    hint: 'Es wurde nichts verändert und nichts gesendet — diese Prüfung betrachtet nur die Seite selbst.',
    stillBlocked: 'Immer noch erkannt. Die App bleibt gesperrt, bis der Blocker für diese Seite aus ist.',
    retry: 'Erneut prüfen',
    learnMore: 'Über GitBinder',
    foot: 'Kostenlos, Open Source und vollständig clientseitig.',
  },
  errors: {
    network: 'GitHub ist nicht erreichbar. Prüfe deine Verbindung und versuche es erneut.',
    unauthorized: 'GitHub hat die Zugangsdaten abgelehnt. Prüfe Benutzername und Token.',
    notFound: 'Es wurde kein GitHub-Benutzer namens „{username}“ gefunden.',
    rateLimit: 'GitHub-Rate-Limit erreicht. Versuche es {time} erneut.',
    forbidden: 'GitHub hat die Anfrage abgelehnt. Dem Token fehlt möglicherweise der Scope „repo“.',
    server: 'GitHub hat einen Fehler gemeldet ({status}). Bitte versuche es gleich erneut.',
    unknown: 'Beim Laden der Repositories ist etwas schiefgelaufen.',
    usernameRequired: 'Gib zuerst einen GitHub-Benutzernamen ein.',
    invalidJson: 'Die Datei konnte nicht als JSON gelesen werden.',
    clipboard: 'Kopieren in die Zwischenablage ist fehlgeschlagen.',
  },

  toasts: {
    fetch: {
      start: 'Lade Repositories für {username} …',
      success: { one: '1 Repository geladen', other: '{count} Repositories geladen' },
      empty: '{username} hat keine sichtbaren Repositories.',
      private: 'Für private Repositories brauchst du ein Personal Access Token.',
      publicOnly: 'Nur öffentliche Repositories — hinterlege ein Token in den Einstellungen, um private einzuschließen.',
      truncated: '{count} Repositories geladen und beim Sicherheitslimit von {pages} Seiten gestoppt. Es könnten welche fehlen.',
    },
    language: {
      changed: 'Sprache der Oberfläche: {language}',
    },
    clipboard: {
      copied: 'In die Zwischenablage kopiert',
    },
    repos: {
      allVisible: 'Alle Repositories ins Buch aufgenommen.',
      noneVisible: 'Alle Repositories aus dem Buch entfernt.',
      restored: 'Filter zurückgesetzt.',
    },
  },

  footer: {
    privacy: 'Kein Backend. Keine Cookies. Kein Tracking.',
    built: 'Für den Browser gebaut von {author}.',
    license: 'MIT-Lizenz',
    version: 'Version {version}',
    source: 'Quellcode',
    support: 'Projekt unterstützen',
    storage: 'Lokaler Speicher: {size}',
  },
};
