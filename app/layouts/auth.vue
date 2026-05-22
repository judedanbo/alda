<script setup lang="ts">
// Auth layout for login, register, etc.
</script>

<template>
  <div class="min-h-screen flex flex-col bg-muted/30">
    <!-- Header with Ghana coat of arms / logo -->
    <header class="py-6 px-4">
      <div class="max-w-md mx-auto flex items-center justify-center gap-3">
        <div
          class="w-12 h-12 rounded-full bg-primary flex items-center justify-center"
        >
          <span class="text-primary-foreground font-bold text-xl">GH</span>
        </div>
        <div>
          <h1 class="text-lg font-semibold text-foreground">
            Asset Declaration Portal
          </h1>
          <p class="text-muted-foreground">Audit Service</p>
          <p class="text-sm text-muted-foreground">Republic of Ghana</p>
        </div>
        <div class="ml-auto">
          <AppThemeSwitcherButton />
        </div>
      </div>
    </header>

    <!-- Main content -->
    <main class="flex-1 flex items-center justify-center p-4">
      <slot />
    </main>

    <!-- Footer -->
    <footer class="py-4 px-4 text-center">
      <p class="text-sm text-muted-foreground">
        &copy; {{ new Date().getFullYear() }} Ghana Audit Service. All rights
        reserved.
      </p>
      <p class="text-xs text-muted-foreground mt-1">
        Article 286(5) - Asset Declaration System
      </p>
      <div class="mt-2 flex items-center justify-center gap-4 text-xs">
        <NuxtLink to="/terms" class="text-muted-foreground hover:text-primary hover:underline">
          Terms of Service
        </NuxtLink>
        <span class="text-muted-foreground">|</span>
        <NuxtLink to="/privacy" class="text-muted-foreground hover:text-primary hover:underline">
          Privacy Policy
        </NuxtLink>
      </div>
    </footer>
  </div>
</template>
