<script setup lang="ts">
definePageMeta({ layout: "default" });

useHead({
  title: "Accessibility — Asset Declaration Portal",
  meta: [
    {
      name: "description",
      content:
        "Accessibility statement and available accessibility features for the Ghana Asset Declaration Portal.",
    },
  ],
});
</script>

<template>
  <article class="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-6">
    <header class="space-y-2">
      <p class="text-sm uppercase tracking-wider text-muted-foreground">
        Republic of Ghana — Audit Service
      </p>
      <h1 class="text-3xl font-semibold text-foreground">Accessibility Statement</h1>
    </header>

    <section class="space-y-3">
      <p class="text-foreground/90 leading-relaxed">
        The Ghana Asset Declaration Portal is committed to ensuring digital
        accessibility for all users, including persons with disabilities, in
        line with Article 286(5) of the 1992 Constitution, the Persons with
        Disability Act, 2006 (Act 715), and Government of Ghana digital
        service standards.
      </p>
    </section>

    <section class="space-y-3">
      <h2 class="text-xl font-semibold text-foreground">Conformance target</h2>
      <p class="text-foreground/90 leading-relaxed">
        We aim to meet
        <strong>Web Content Accessibility Guidelines (WCAG) 2.1, Level AA</strong>.
        Some areas of the portal are still being brought into full conformance
        — see <em>Known limitations</em> below.
      </p>
    </section>

    <section class="space-y-3">
      <h2 class="text-xl font-semibold text-foreground">Built-in accessibility features</h2>
      <ul class="list-disc pl-6 space-y-2 text-foreground/90 leading-relaxed">
        <li>
          <strong>Adjustable text size</strong> — four levels, scaling the
          interface from default to 150%.
        </li>
        <li>
          <strong>Reduce motion</strong> — disables non-essential animations
          and transitions. Honours your operating-system preference by default.
        </li>
        <li>
          <strong>Underline links</strong> — adds underlines to in-content
          links so they don't rely on colour alone.
        </li>
        <li>
          <strong>Readable font</strong> — switches the body font to
          <em>Atkinson Hyperlegible</em>, designed for legibility.
        </li>
        <li>
          <strong>High-contrast and other colour themes</strong> — Light, Dark,
          High Contrast, Sepia, and Solarized themes are available alongside
          your system preference.
        </li>
        <li>
          <strong>Skip to main content</strong> — press
          <kbd class="px-1.5 py-0.5 rounded bg-muted text-xs">Tab</kbd> when a
          page loads to skip past the header and navigation.
        </li>
        <li><strong>Visible keyboard focus</strong> on every interactive control.</li>
      </ul>
    </section>

    <section class="space-y-3">
      <h2 class="text-xl font-semibold text-foreground">How to adjust your settings</h2>
      <p class="text-foreground/90 leading-relaxed">
        Click the accessibility icon at the bottom-left of any page to open
        the settings panel, or visit
        <NuxtLink to="/settings/preferences" class="text-primary hover:underline">
          Settings → Preferences
        </NuxtLink>
        when signed in. Your choices are remembered on this device and synced
        to your account when you log in, so they follow you across devices.
      </p>
    </section>

    <section class="space-y-3">
      <h2 class="text-xl font-semibold text-foreground">Known limitations</h2>
      <ul class="list-disc pl-6 space-y-2 text-foreground/90 leading-relaxed">
        <li>
          Some receipt PDFs are generated from scanned forms; alternative
          formats are available on request.
        </li>
        <li>
          Form-level labelling and image alt-text audits across role-specific
          pages are in progress.
        </li>
      </ul>
    </section>

    <section class="space-y-3">
      <h2 class="text-xl font-semibold text-foreground">Feedback</h2>
      <p class="text-foreground/90 leading-relaxed">
        If you encounter an accessibility barrier, please contact us via the
        <NuxtLink to="/contact" class="text-primary hover:underline">contact form</NuxtLink>
        so we can address it.
      </p>
    </section>

    <p class="text-sm text-muted-foreground pt-4 border-t">
      Last reviewed: <time datetime="2026-05-22">22 May 2026</time>.
    </p>
  </article>
</template>
