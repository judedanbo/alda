<script setup lang="ts">
// Landing page for the Asset Declaration Portal
</script>

<template>
  <div class="min-h-screen">
    <!-- Hero Section -->
    <header class="bg-primary text-primary-foreground">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav class="flex items-center justify-between py-6">
          <div class="flex items-center gap-3">
            <div
              class="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center"
            >
              <NuxtLink to="/" class="font-bold text-xl">GH</NuxtLink>
            </div>
            <div>
              <h1 class="text-lg font-semibold">Asset Declaration Portal</h1>
              <p class="text-primary-foreground/80">Audit Service</p>
              <p class="text-sm text-primary-foreground/80">
                Republic of Ghana
              </p>
            </div>
          </div>
          <div class="flex items-center gap-4">
            <Button variant="link" as-child class="text-primary-foreground hover:text-primary-foreground/80">
              <NuxtLink to="/auth/login">Sign in</NuxtLink>
            </Button>
            <Button variant="secondary" as-child>
              <NuxtLink to="/auth/register">Create account</NuxtLink>
            </Button>
          </div>
        </nav>

        <div class="py-20 text-center">
          <h2 class="text-4xl sm:text-5xl font-bold mb-6">
            Asset Declaration System
          </h2>
          <p class="text-xl text-primary-foreground/80 max-w-2xl mx-auto mb-8">
            Online portal for public officials to submit their asset
            declarations as required under Article 286(5) of the 1992
            Constitution of Ghana.
          </p>
          <div class="flex items-center justify-center gap-4">
            <Button size="lg" variant="secondary" as-child>
              <NuxtLink to="/auth/register">Start Declaration</NuxtLink>
            </Button>
            <Button size="lg" variant="outline" as-child class="border-white/30 text-primary-foreground hover:bg-white/10">
              <a href="#how-it-works">Learn more</a>
            </Button>
          </div>
        </div>
      </div>
    </header>

    <!-- How It Works Section -->
    <section id="how-it-works" class="py-20 bg-muted/30">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center mb-16">
          <h2 class="text-3xl font-bold text-foreground mb-4">How It Works</h2>
          <p class="text-muted-foreground max-w-2xl mx-auto">
            Complete your asset declaration in four simple steps
          </p>
        </div>

        <div class="grid md:grid-cols-4 gap-8">
          <Card class="text-center border-none shadow-none bg-transparent">
            <CardContent class="pt-6">
              <div
                class="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center"
              >
                <span class="text-2xl font-bold text-primary">1</span>
              </div>
              <CardTitle class="text-lg mb-2">Register</CardTitle>
              <p class="text-sm text-muted-foreground">
                Create an account with your email and Ghana Card details
              </p>
            </CardContent>
          </Card>

          <Card class="text-center border-none shadow-none bg-transparent">
            <CardContent class="pt-6">
              <div
                class="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center"
              >
                <span class="text-2xl font-bold text-primary">2</span>
              </div>
              <CardTitle class="text-lg mb-2">Submit</CardTitle>
              <p class="text-sm text-muted-foreground">
                Complete and submit your asset declaration form
              </p>
            </CardContent>
          </Card>

          <Card class="text-center border-none shadow-none bg-transparent">
            <CardContent class="pt-6">
              <div
                class="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center"
              >
                <span class="text-2xl font-bold text-primary">3</span>
              </div>
              <CardTitle class="text-lg mb-2">Review</CardTitle>
              <p class="text-sm text-muted-foreground">
                Your declaration is reviewed by the Legal Unit and GAS officers
              </p>
            </CardContent>
          </Card>

          <Card class="text-center border-none shadow-none bg-transparent">
            <CardContent class="pt-6">
              <div
                class="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center"
              >
                <span class="text-2xl font-bold text-primary">4</span>
              </div>
              <CardTitle class="text-lg mb-2">Receive</CardTitle>
              <p class="text-sm text-muted-foreground">
                Get your receipt once your declaration is approved and sealed
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>

    <!-- Who Must Declare Section -->
    <section class="py-20">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center mb-16">
          <h2 class="text-3xl font-bold text-foreground mb-4">
            Who Must Declare?
          </h2>
          <p class="text-muted-foreground max-w-2xl mx-auto">
            Under Article 286(5) of the 1992 Constitution, the following public
            officials are required to declare their assets
          </p>
        </div>

        <div class="grid md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Executive Branch</CardTitle>
            </CardHeader>
            <CardContent>
              <ul class="text-sm text-muted-foreground space-y-2">
                <li>- President and Vice President</li>
                <li>- Ministers and Deputy Ministers</li>
                <li>- Secretary to Cabinet</li>
                <li>- Heads of Ministries</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Legislative Branch</CardTitle>
            </CardHeader>
            <CardContent>
              <ul class="text-sm text-muted-foreground space-y-2">
                <li>- Speaker and Deputy Speakers</li>
                <li>- Members of Parliament</li>
                <li>- Parliamentary Staff (senior)</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Judicial Branch</CardTitle>
            </CardHeader>
            <CardContent>
              <ul class="text-sm text-muted-foreground space-y-2">
                <li>- Chief Justice</li>
                <li>- Justices of Superior Courts</li>
                <li>- Regional Tribunal Chairmen</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Public Enterprises</CardTitle>
            </CardHeader>
            <CardContent>
              <ul class="text-sm text-muted-foreground space-y-2">
                <li>- Board Chairmen and Members</li>
                <li>- Managing Directors</li>
                <li>- Deputy Managing Directors</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Security Services</CardTitle>
            </CardHeader>
            <CardContent>
              <ul class="text-sm text-muted-foreground space-y-2">
                <li>- Police Service Officers</li>
                <li>- Armed Forces Officers</li>
                <li>- Immigration & Prisons Officers</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Others</CardTitle>
            </CardHeader>
            <CardContent>
              <ul class="text-sm text-muted-foreground space-y-2">
                <li>- Ambassadors & High Commissioners</li>
                <li>- Heads of Educational Institutions</li>
                <li>- Members of Regulatory Bodies</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <footer class="py-12 bg-muted/50 border-t">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div
          class="flex flex-col md:flex-row items-center justify-between gap-6"
        >
          <div class="flex items-center gap-3">
            <div
              class="w-10 h-10 rounded-full bg-primary flex items-center justify-center"
            >
              <span class="text-primary-foreground font-bold">GH</span>
            </div>
            <div>
              <p class="font-semibold text-foreground">
                Asset Declaration Portal
              </p>
              <p class="text-sm text-muted-foreground">Audit Service</p>
              <p class="text-sm text-muted-foreground">Republic of Ghana</p>
            </div>
          </div>

          <div class="flex items-center gap-6 text-sm text-muted-foreground">
            <NuxtLink to="/privacy" class="hover:text-foreground"
              >Privacy Policy</NuxtLink
            >
            <NuxtLink to="/terms" class="hover:text-foreground"
              >Terms of Service</NuxtLink
            >
            <NuxtLink to="/contact" class="hover:text-foreground"
              >Contact</NuxtLink
            >
          </div>

          <p class="text-sm text-muted-foreground">
            &copy; {{ new Date().getFullYear() }} Audit Service
          </p>
        </div>
      </div>
    </footer>
  </div>
</template>
