<script setup lang="ts">
import { Mail, Phone, MapPin } from 'lucide-vue-next'
import { useAuthStore } from '~/stores/auth'

const authStore = useAuthStore()
</script>

<template>
  <footer class="bg-muted text-foreground">
    <!-- Ghana tricolor accent -->
    <div
      class="h-[3px]"
      style="background: linear-gradient(to right, #006B3F, #FCD116, #CE1126)"
    />

    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
        <!-- Organization -->
        <div class="lg:col-span-1">
          <NuxtLink to="/" class="flex items-center gap-3 mb-4">
            <div
              class="w-9 h-9 rounded-full bg-primary flex items-center justify-center"
            >
              <span class="text-primary-foreground font-bold text-sm">GH</span>
            </div>
            <div>
              <div class="font-semibold text-sm">Asset Declaration Portal</div>
              <div class="text-xs opacity-60">Ghana Audit Service</div>
            </div>
          </NuxtLink>
          <p class="text-sm opacity-60 leading-relaxed">
            Ensuring transparency and accountability in public service through
            constitutional compliance.
          </p>
        </div>

        <!-- Quick Links -->
        <div>
          <h3
            class="text-xs font-semibold uppercase tracking-wider opacity-50 mb-4"
          >
            Quick Links
          </h3>
          <ul class="space-y-2 text-sm">
            <li>
              <!--
                Auth state is client-only (localStorage); render the signed-out
                link as the SSR fallback to avoid a hydration mismatch.
              -->
              <ClientOnly>
                <NuxtLink
                  v-if="authStore.isAuthenticated"
                  :to="authStore.dashboardPath"
                  class="opacity-70 hover:opacity-100 transition-opacity"
                >
                  Dashboard
                </NuxtLink>
                <NuxtLink
                  v-else
                  to="/auth/register"
                  class="opacity-70 hover:opacity-100 transition-opacity"
                >
                  Start Declaration
                </NuxtLink>
                <template #fallback>
                  <NuxtLink
                    to="/auth/register"
                    class="opacity-70 hover:opacity-100 transition-opacity"
                  >
                    Start Declaration
                  </NuxtLink>
                </template>
              </ClientOnly>
            </li>
            <li>
              <a
                href="#about-act-550"
                class="opacity-70 hover:opacity-100 transition-opacity"
              >
                About Act 550
              </a>
            </li>
            <li>
              <a
                href="#how-it-works"
                class="opacity-70 hover:opacity-100 transition-opacity"
              >
                How It Works
              </a>
            </li>
            <li>
              <a
                href="#who-must-declare"
                class="opacity-70 hover:opacity-100 transition-opacity"
              >
                Who Must Declare
              </a>
            </li>
            <li>
              <a
                href="#faq"
                class="opacity-70 hover:opacity-100 transition-opacity"
              >
                FAQ
              </a>
            </li>
          </ul>
        </div>

        <!-- Legal -->
        <div>
          <h3
            class="text-xs font-semibold uppercase tracking-wider opacity-50 mb-4"
          >
            Legal
          </h3>
          <ul class="space-y-2 text-sm">
            <li>
              <NuxtLink
                to="/privacy"
                class="opacity-70 hover:opacity-100 transition-opacity"
              >
                Privacy Policy
              </NuxtLink>
            </li>
            <li>
              <NuxtLink
                to="/terms"
                class="opacity-70 hover:opacity-100 transition-opacity"
              >
                Terms of Service
              </NuxtLink>
            </li>
            <li>
              <NuxtLink
                to="/contact"
                class="opacity-70 hover:opacity-100 transition-opacity"
              >
                Contact Us
              </NuxtLink>
            </li>
            <li>
              <NuxtLink
                to="/accessibility"
                class="opacity-70 hover:opacity-100 transition-opacity"
              >
                Accessibility
              </NuxtLink>
            </li>
          </ul>
        </div>

        <!-- Contact -->
        <div>
          <h3
            class="text-xs font-semibold uppercase tracking-wider opacity-50 mb-4"
          >
            Contact
          </h3>
          <ul class="space-y-3 text-sm">
            <li class="flex items-center gap-2 opacity-70">
              <Mail class="size-4 shrink-0" />
              <span>info@ghaudit.org</span>
            </li>
            <li class="flex items-center gap-2 opacity-70">
              <Phone class="size-4 shrink-0" />
              <span>+233 302 664 920</span>
            </li>
            <li class="flex items-center gap-2 opacity-70">
              <MapPin class="size-4 shrink-0" />
              <span>Accra, Ghana</span>
            </li>
            <li>
              <NuxtLink
                to="/contact"
                class="opacity-70 hover:opacity-100 transition-opacity"
              >
                Contact Form →
              </NuxtLink>
            </li>
          </ul>
        </div>
      </div>

      <!-- Bottom bar -->
      <div
        class="border-t border-border mt-10 pt-6 flex flex-col sm:flex-row justify-between items-center gap-2 text-xs opacity-50"
      >
        <span>© {{ new Date().getFullYear() }} Ghana Audit Service. All rights reserved.</span>
        <span>Republic of Ghana</span>
      </div>
    </div>
  </footer>
</template>
