<script setup lang="ts">
import {
  Bell,
  Inbox,
  Info,
  Plus,
  Settings,
  TriangleAlert,
} from "lucide-vue-next";

definePageMeta({
  layout: "default",
  middleware: "dev-only",
});

useHead({ title: "Component Showcase" });

const { current: currentTheme, themes, setTheme } = useTheme();

// Form primitive state
const textValue = ref("");
const textareaValue = ref("");
const selectValue = ref("");
const checkboxValue = ref(false);
const switchValue = ref(false);
const singleFile = ref<File | null>(null);
const multiFiles = ref<File[]>([]);

// FormField demo state
const ffName = ref("");
const ffEmail = ref("");
const ffBio = ref("");
const ffRegion = ref("");
const ffConsent = ref(false);
const ffEmailError = computed(() =>
  ffEmail.value && !ffEmail.value.includes("@") ? "Enter a valid email address." : undefined,
);

// Date pickers state
const dateValue = ref<string | null>(null);
const dateTimeValue = ref<string | null>(null);
const dateBoundedValue = ref<string | null>(null);
const dateDisabledValue = ref<string | null>("2026-05-24");
const rangeFrom = ref<string | null>(null);
const rangeTo = ref<string | null>(null);
const popoverDate = ref<string | null>(null);

// NativeSelect / RadioGroup / Combobox / TagsInput state
const nativeSelectValue = ref("greater-accra");
const radioValue = ref("schedule_officer");
const comboboxValue = ref<string>("");
const comboboxOptions = [
  { value: "ministry-of-finance", label: "Ministry of Finance" },
  { value: "ministry-of-health", label: "Ministry of Health" },
  { value: "ministry-of-education", label: "Ministry of Education" },
  { value: "ghana-revenue-authority", label: "Ghana Revenue Authority" },
  { value: "auditor-general", label: "Auditor General Department" },
  { value: "bank-of-ghana", label: "Bank of Ghana" },
];
const tagsValue = ref<string[]>(["ghana", "compliance"]);

// Compound component state
const tabValue = ref("overview");
const dialogOpen = ref(false);
const sheetOpen = ref(false);
const paginationPage = ref(1);

const buttonVariants = ["default", "outline", "secondary", "ghost", "destructive", "link"] as const;
const buttonSizes = ["xs", "sm", "default", "lg"] as const;
const badgeVariants = ["default", "secondary", "destructive", "outline", "ghost", "link"] as const;
const inputTypes = ["text", "email", "password", "number", "search", "tel", "url"] as const;

const tableRows = [
  { code: "ADLA-001", name: "Ama Mensah", status: "APPROVED" },
  { code: "ADLA-002", name: "Kofi Asante", status: "UNDER_REVIEW" },
  { code: "ADLA-003", name: "Akua Boateng", status: "REJECTED" },
];

const avatarImage
  = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'><rect width='64' height='64' fill='%23006B3F'/><text x='32' y='41' font-size='26' fill='white' text-anchor='middle' font-family='sans-serif'>GH</text></svg>";
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-12 px-4 py-10">
    <header class="space-y-2">
      <h1 class="text-2xl font-bold text-foreground">
        Component Showcase
      </h1>
      <p class="text-sm text-muted-foreground">
        Living reference for every UI primitive. Dev-only route.
      </p>
      <div class="flex flex-wrap gap-2 pt-2">
        <Button
          v-for="theme in themes"
          :key="theme.id"
          size="sm"
          :variant="currentTheme === theme.id ? 'default' : 'outline'"
          @click="setTheme(theme.id)"
        >
          {{ theme.label }}
        </Button>
      </div>
    </header>

    <!-- Buttons -->
    <section class="space-y-4">
      <h2 class="text-lg font-semibold text-foreground">
        Button
      </h2>
      <div class="flex flex-wrap items-center gap-3">
        <Button v-for="variant in buttonVariants" :key="variant" :variant="variant">
          {{ variant }}
        </Button>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <Button v-for="size in buttonSizes" :key="size" :size="size">
          size: {{ size }}
        </Button>
        <Button size="icon" aria-label="Add">
          <Plus aria-hidden="true" />
        </Button>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <Button disabled>
          Disabled
        </Button>
        <Button variant="outline">
          <Plus /> With icon
        </Button>
      </div>
    </section>

    <!-- Badge -->
    <section class="space-y-4">
      <h2 class="text-lg font-semibold text-foreground">
        Badge
      </h2>
      <div class="flex flex-wrap items-center gap-3">
        <Badge v-for="variant in badgeVariants" :key="variant" :variant="variant">
          {{ variant }}
        </Badge>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <StatusBadge status="CODE_GENERATED" />
        <StatusBadge status="UNDER_REVIEW" />
        <StatusBadge status="APPROVED" />
        <StatusBadge status="REJECTED" />
        <StatusBadge status="SEALED" />
      </div>
    </section>

    <!-- Alert -->
    <section class="space-y-4">
      <h2 class="text-lg font-semibold text-foreground">
        Alert
      </h2>
      <Alert>
        <Info />
        <AlertTitle>Heads up</AlertTitle>
        <AlertDescription>This is a default informational alert.</AlertDescription>
      </Alert>
      <Alert variant="destructive">
        <TriangleAlert />
        <AlertTitle>Something went wrong</AlertTitle>
        <AlertDescription>This is a destructive alert.</AlertDescription>
      </Alert>
    </section>

    <!-- Input -->
    <section class="space-y-4">
      <h2 class="text-lg font-semibold text-foreground">
        Input
      </h2>
      <div class="grid gap-3 sm:grid-cols-2">
        <div v-for="type in inputTypes" :key="type" class="space-y-1">
          <Label>type: {{ type }}</Label>
          <Input :type="type" :placeholder="type" />
        </div>
      </div>
      <div class="grid gap-3 sm:grid-cols-2">
        <Input v-model="textValue" placeholder="Bound v-model" />
        <Input placeholder="Disabled" disabled />
        <Input placeholder="Invalid" aria-invalid="true" />
      </div>
      <p class="text-xs text-muted-foreground">
        Bound value: {{ textValue || "(empty)" }}
      </p>
    </section>

    <!-- DatePicker -->
    <section class="space-y-4">
      <h2 class="text-lg font-semibold text-foreground">
        DatePicker
      </h2>
      <p class="text-sm text-muted-foreground">
        Calendar-based date selector. Renders the same way across all browsers
        (replaces native <code>&lt;input type="date"&gt;</code>).
      </p>
      <div class="grid gap-3 sm:grid-cols-2">
        <div class="space-y-1">
          <Label>Date (day granularity)</Label>
          <DatePicker v-model="dateValue" block />
          <p class="text-xs text-muted-foreground">
            Bound value: {{ dateValue || "(empty)" }}
          </p>
        </div>
        <div class="space-y-1">
          <Label>Date + time</Label>
          <DatePicker v-model="dateTimeValue" granularity="minute" block />
          <p class="text-xs text-muted-foreground">
            Bound value: {{ dateTimeValue || "(empty)" }}
          </p>
        </div>
        <div class="space-y-1">
          <Label>Min/max bounded (this year only)</Label>
          <DatePicker
            v-model="dateBoundedValue"
            min="2026-01-01"
            max="2026-12-31"
            placeholder="Pick a 2026 date"
            block
          />
        </div>
        <div class="space-y-1">
          <Label>Disabled</Label>
          <DatePicker v-model="dateDisabledValue" disabled block />
        </div>
        <div class="space-y-1 sm:col-span-2">
          <Label>Inline (no popover) — Calendar primitive</Label>
          <div class="rounded-lg border bg-card w-fit">
            <Calendar />
          </div>
        </div>
      </div>
    </section>

    <!-- DateRangePicker -->
    <section class="space-y-4">
      <h2 class="text-lg font-semibold text-foreground">
        DateRangePicker
      </h2>
      <p class="text-sm text-muted-foreground">
        Two-month range selector for filter bars and reports.
      </p>
      <DateRangePicker
        v-model:from="rangeFrom"
        v-model:to="rangeTo"
      />
      <p class="text-xs text-muted-foreground">
        From: {{ rangeFrom || "(empty)" }} — To: {{ rangeTo || "(empty)" }}
      </p>
    </section>

    <!-- Popover -->
    <section class="space-y-4">
      <h2 class="text-lg font-semibold text-foreground">
        Popover
      </h2>
      <p class="text-sm text-muted-foreground">
        Standalone popover primitive — the foundation for DatePicker and any
        floating panel UI.
      </p>
      <Popover>
        <PopoverTrigger as-child>
          <Button variant="outline">
            Open popover
          </Button>
        </PopoverTrigger>
        <PopoverContent>
          <div class="space-y-2">
            <h4 class="text-sm font-semibold">
              Dimensions
            </h4>
            <p class="text-xs text-muted-foreground">
              Set padding and dimensions for the layer.
            </p>
            <div class="space-y-1">
              <Label class="text-xs">Date</Label>
              <DatePicker v-model="popoverDate" block />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </section>

    <!-- FileInput -->
    <section class="space-y-4">
      <h2 class="text-lg font-semibold text-foreground">
        FileInput
      </h2>
      <FileInput v-model="singleFile" accept="image/*" />
      <FileInput v-model="multiFiles" multiple button-label="Add images" />
      <FileInput :model-value="null" disabled />
    </section>

    <!-- Textarea -->
    <section class="space-y-4">
      <h2 class="text-lg font-semibold text-foreground">
        Textarea
      </h2>
      <Textarea v-model="textareaValue" placeholder="Write something…" />
      <Textarea placeholder="Disabled" disabled />
    </section>

    <!-- Select -->
    <section class="space-y-4">
      <h2 class="text-lg font-semibold text-foreground">
        Select
      </h2>
      <Select v-model="selectValue">
        <SelectTrigger class="w-64">
          <SelectValue placeholder="Select a region" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="greater-accra">
            Greater Accra
          </SelectItem>
          <SelectItem value="ashanti">
            Ashanti
          </SelectItem>
          <SelectItem value="northern">
            Northern
          </SelectItem>
        </SelectContent>
      </Select>
      <p class="text-xs text-muted-foreground">
        Selected: {{ selectValue || "(none)" }}
      </p>
    </section>

    <!-- NativeSelect -->
    <section class="space-y-4">
      <h2 class="text-lg font-semibold text-foreground">
        NativeSelect
      </h2>
      <p class="text-sm text-muted-foreground">
        Styled wrapper around the native <code>&lt;select&gt;</code>. The
        closed-state trigger matches our other inputs across browsers; the
        open menu uses each browser's native picker (good for very long
        lists and mobile UX).
      </p>
      <div class="grid gap-3 sm:grid-cols-2">
        <div class="space-y-1">
          <Label>Region</Label>
          <NativeSelect v-model="nativeSelectValue">
            <option value="greater-accra">
              Greater Accra
            </option>
            <option value="ashanti">
              Ashanti
            </option>
            <option value="northern">
              Northern
            </option>
            <option value="volta">
              Volta
            </option>
          </NativeSelect>
        </div>
        <div class="space-y-1">
          <Label>Small + disabled</Label>
          <NativeSelect size="sm" disabled>
            <option>Disabled</option>
          </NativeSelect>
        </div>
      </div>
      <p class="text-xs text-muted-foreground">
        Selected: {{ nativeSelectValue }}
      </p>
    </section>

    <!-- RadioGroup -->
    <section class="space-y-4">
      <h2 class="text-lg font-semibold text-foreground">
        RadioGroup
      </h2>
      <p class="text-sm text-muted-foreground">
        Mutually-exclusive choices with consistent styling across browsers.
      </p>
      <RadioGroup v-model="radioValue">
        <div class="flex items-center gap-2">
          <RadioGroupItem id="role-applicant" value="applicant" />
          <Label for="role-applicant">Applicant</Label>
        </div>
        <div class="flex items-center gap-2">
          <RadioGroupItem id="role-officer" value="schedule_officer" />
          <Label for="role-officer">Schedule Officer</Label>
        </div>
        <div class="flex items-center gap-2">
          <RadioGroupItem id="role-legal" value="legal_unit" />
          <Label for="role-legal">Legal Unit</Label>
        </div>
        <div class="flex items-center gap-2">
          <RadioGroupItem id="role-admin" value="admin" />
          <Label for="role-admin">Admin</Label>
        </div>
      </RadioGroup>
      <p class="text-xs text-muted-foreground">
        Selected: {{ radioValue }}
      </p>
    </section>

    <!-- Combobox -->
    <section class="space-y-4">
      <h2 class="text-lg font-semibold text-foreground">
        Combobox
      </h2>
      <p class="text-sm text-muted-foreground">
        Searchable select with keyboard navigation. Use for long lists like
        institutions, where typing-to-filter is more usable than scrolling.
      </p>
      <Combobox v-model="comboboxValue" :ignore-filter="false" class="w-64">
        <ComboboxAnchor>
          <ComboboxInput placeholder="Search institutions..." />
          <ComboboxTrigger />
        </ComboboxAnchor>
        <ComboboxContent>
          <ComboboxEmpty />
          <ComboboxGroup>
            <ComboboxLabel>Institutions</ComboboxLabel>
            <ComboboxItem
              v-for="opt in comboboxOptions"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </ComboboxItem>
          </ComboboxGroup>
        </ComboboxContent>
      </Combobox>
      <p class="text-xs text-muted-foreground">
        Selected: {{ comboboxValue || "(none)" }}
      </p>
    </section>

    <!-- TagsInput / MultiSelect -->
    <section class="space-y-4">
      <h2 class="text-lg font-semibold text-foreground">
        TagsInput (MultiSelect)
      </h2>
      <p class="text-sm text-muted-foreground">
        Chip-style tag input. Type a value and press Enter to add; click
        the X (or press Backspace) to remove.
      </p>
      <TagsInput v-model="tagsValue" class="max-w-md">
        <TagsInputItem v-for="tag in tagsValue" :key="tag" :value="tag">
          <TagsInputItemText />
          <TagsInputItemDelete />
        </TagsInputItem>
        <TagsInputInput placeholder="Add a tag..." />
      </TagsInput>
      <p class="text-xs text-muted-foreground">
        Tags: {{ tagsValue.length ? tagsValue.join(", ") : "(none)" }}
      </p>
    </section>

    <!-- Checkbox & Switch -->
    <section class="space-y-4">
      <h2 class="text-lg font-semibold text-foreground">
        Checkbox &amp; Switch
      </h2>
      <div class="flex items-center gap-2">
        <Checkbox id="demo-checkbox" v-model="checkboxValue" />
        <Label for="demo-checkbox">Checkbox ({{ checkboxValue }})</Label>
      </div>
      <div class="flex items-center gap-2">
        <Switch id="demo-switch" v-model="switchValue" />
        <Label for="demo-switch">Switch ({{ switchValue }})</Label>
      </div>
    </section>

    <!-- FormField -->
    <section class="space-y-4">
      <h2 class="text-lg font-semibold text-foreground">
        FormField
      </h2>
      <p class="text-sm text-muted-foreground">
        Wraps a label, control, hint and error with consistent spacing and aria wiring.
      </p>
      <div class="grid gap-5 sm:grid-cols-2">
        <FormField
          v-slot="{ id, ariaDescribedby }"
          label="Full name"
          required
          hint="As it appears on your Ghana Card."
        >
          <Input :id="id" v-model="ffName" :aria-describedby="ariaDescribedby" placeholder="Ama Mensah" />
        </FormField>

        <FormField
          v-slot="{ id, ariaInvalid, ariaDescribedby }"
          label="Email"
          :error="ffEmailError"
        >
          <Input
            :id="id"
            v-model="ffEmail"
            type="email"
            :aria-invalid="ariaInvalid"
            :aria-describedby="ariaDescribedby"
            placeholder="you@example.com"
          />
        </FormField>

        <FormField
          v-slot="{ id, ariaDescribedby }"
          label="Region"
          required
        >
          <Select v-model="ffRegion">
            <SelectTrigger :id="id" :aria-describedby="ariaDescribedby" class="w-full">
              <SelectValue placeholder="Select a region" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="greater-accra">
                Greater Accra
              </SelectItem>
              <SelectItem value="ashanti">
                Ashanti
              </SelectItem>
            </SelectContent>
          </Select>
        </FormField>

        <FormField
          v-slot="{ id }"
          label="Supporting document"
          hint="PDF or image, max 5MB."
        >
          <FileInput :id="id" accept=".pdf,image/*" />
        </FormField>

        <FormField
          v-slot="{ id, ariaDescribedby }"
          label="Short bio"
          class="sm:col-span-2"
        >
          <Textarea :id="id" v-model="ffBio" :aria-describedby="ariaDescribedby" placeholder="Tell us about yourself" />
        </FormField>

        <FormField
          v-slot="{ id }"
          label="I consent to the declaration terms"
          required
        >
          <Checkbox :id="id" v-model="ffConsent" />
        </FormField>
      </div>
    </section>

    <!-- EmptyState -->
    <section class="space-y-4">
      <h2 class="text-lg font-semibold text-foreground">
        EmptyState
      </h2>
      <Card>
        <CardContent>
          <EmptyState title="No declarations yet" description="Declarations you create will appear here." />
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <EmptyState
            :icon="Inbox"
            title="Your inbox is empty"
            description="New notifications will show up here."
          >
            <template #action>
              <Button size="sm">
                Refresh
              </Button>
            </template>
          </EmptyState>
        </CardContent>
      </Card>
    </section>

    <!-- Avatar -->
    <section class="space-y-4">
      <h2 class="text-lg font-semibold text-foreground">
        Avatar
      </h2>
      <div class="flex flex-wrap items-center gap-4">
        <Avatar size="sm" name="Ama Mensah" />
        <Avatar name="Kofi Asante" />
        <Avatar size="lg" name="Akua Boateng" />
        <Avatar size="lg" :src="avatarImage" name="Ghana" />
      </div>
    </section>

    <!-- Card -->
    <section class="space-y-4">
      <h2 class="text-lg font-semibold text-foreground">
        Card
      </h2>
      <Card class="max-w-sm">
        <CardHeader>
          <CardTitle>Declaration summary</CardTitle>
          <CardDescription>Article 286(5) compliance.</CardDescription>
        </CardHeader>
        <CardContent>
          <p class="text-sm text-muted-foreground">
            Card body content goes here.
          </p>
        </CardContent>
        <CardFooter>
          <Button size="sm">
            View
          </Button>
        </CardFooter>
      </Card>
    </section>

    <!-- Table -->
    <section class="space-y-4">
      <h2 class="text-lg font-semibold text-foreground">
        Table
      </h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead>Applicant</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="row in tableRows" :key="row.code">
            <TableCell class="font-mono">
              {{ row.code }}
            </TableCell>
            <TableCell>{{ row.name }}</TableCell>
            <TableCell><StatusBadge :status="row.status" /></TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </section>

    <!-- Tabs -->
    <section class="space-y-4">
      <h2 class="text-lg font-semibold text-foreground">
        Tabs
      </h2>
      <Tabs v-model="tabValue" class="w-full">
        <TabsList>
          <TabsTrigger value="overview">
            Overview
          </TabsTrigger>
          <TabsTrigger value="activity">
            Activity
          </TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <p class="text-sm text-muted-foreground">
            Overview tab content.
          </p>
        </TabsContent>
        <TabsContent value="activity">
          <p class="text-sm text-muted-foreground">
            Activity tab content.
          </p>
        </TabsContent>
      </Tabs>
    </section>

    <!-- Accordion -->
    <section class="space-y-4">
      <h2 class="text-lg font-semibold text-foreground">
        Accordion
      </h2>
      <Accordion type="single" collapsible class="w-full">
        <AccordionItem value="item-1">
          <AccordionTrigger>What is a declaration?</AccordionTrigger>
          <AccordionContent>A tracked asset declaration record.</AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-2">
          <AccordionTrigger>How is it verified?</AccordionTrigger>
          <AccordionContent>By the Legal Unit using the unique code.</AccordionContent>
        </AccordionItem>
      </Accordion>
    </section>

    <!-- Dialog & Sheet -->
    <section class="space-y-4">
      <h2 class="text-lg font-semibold text-foreground">
        Dialog &amp; Sheet
      </h2>
      <div class="flex flex-wrap gap-3">
        <Dialog v-model:open="dialogOpen">
          <DialogTrigger as-child>
            <Button variant="outline">
              Open dialog
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm action</DialogTitle>
              <DialogDescription>This is an example dialog.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" @click="dialogOpen = false">
                Cancel
              </Button>
              <Button @click="dialogOpen = false">
                Confirm
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Sheet v-model:open="sheetOpen">
          <SheetTrigger as-child>
            <Button variant="outline">
              Open sheet
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Side sheet</SheetTitle>
              <SheetDescription>This is an example slide-out panel.</SheetDescription>
            </SheetHeader>
          </SheetContent>
        </Sheet>
      </div>
    </section>

    <!-- Dropdown & Tooltip -->
    <section class="space-y-4">
      <h2 class="text-lg font-semibold text-foreground">
        Dropdown Menu &amp; Tooltip
      </h2>
      <div class="flex flex-wrap gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button variant="outline">
              <Settings /> Menu
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Edit</DropdownMenuItem>
            <DropdownMenuItem>Duplicate</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button variant="outline">
                <Bell /> Hover me
              </Button>
            </TooltipTrigger>
            <TooltipContent>You have new notifications</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </section>

    <!-- Pagination -->
    <section class="space-y-4">
      <h2 class="text-lg font-semibold text-foreground">
        Pagination
      </h2>
      <Pagination
        v-slot="{ page }"
        v-model:page="paginationPage"
        :items-per-page="10"
        :total="50"
        :sibling-count="1"
        show-edges
      >
        <PaginationContent v-slot="{ items }">
          <PaginationFirst />
          <PaginationPrevious />
          <template v-for="(item, index) in items" :key="index">
            <PaginationItem
              v-if="item.type === 'page'"
              :value="item.value"
              :is-active="item.value === page"
            >
              {{ item.value }}
            </PaginationItem>
            <PaginationEllipsis v-else :index="index" />
          </template>
          <PaginationNext />
          <PaginationLast />
        </PaginationContent>
      </Pagination>
    </section>

    <!-- Skeleton & Separator -->
    <section class="space-y-4">
      <h2 class="text-lg font-semibold text-foreground">
        Skeleton &amp; Separator
      </h2>
      <div class="space-y-2">
        <Skeleton class="h-4 w-3/4" />
        <Skeleton class="h-4 w-1/2" />
        <Skeleton class="h-24 w-full" />
      </div>
      <Separator />
      <div class="flex h-8 items-center gap-3 text-sm text-muted-foreground">
        <span>Left</span>
        <Separator orientation="vertical" />
        <span>Right</span>
      </div>
    </section>
  </div>
</template>
