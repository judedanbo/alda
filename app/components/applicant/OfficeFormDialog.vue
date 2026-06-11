<script setup lang="ts">
// Shared "add / edit a public office" form, presented in a modal dialog.
// Used by the applicant profile setup wizard and the edit-profile screen so
// the two stay consistent. This component owns presentation + validation only;
// the parent performs the API call (POST to add, PUT to edit) and keeps the
// offices list. Pass `office` to seed edit mode; omit it for add mode.

interface CategoryOption {
  id: number;
  name: string;
}

interface InstitutionOption {
  id: string;
  name: string;
}

interface OfficeSeed {
  designation: string;
  officeCategoryId: number | null;
  institutionId: string | null;
  startDate: string;
  endDate: string | null;
}

interface OfficePayload {
  designation: string;
  officeCategoryId: number;
  institutionId: string | null;
  startDate: string;
  endDate: string;
}

const props = defineProps<{
  open: boolean;
  categories: CategoryOption[];
  institutions: InstitutionOption[];
  office?: OfficeSeed | null;
  saving?: boolean;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  submit: [payload: OfficePayload];
}>();

const isEditing = computed(() => !!props.office);

const today = () => new Date().toISOString().split("T")[0]!;

const officeForm = reactive({
  designation: "",
  institutionId: null as string | null,
  officeCategoryId: null as number | null,
  startDate: today(),
  endDate: "",
});

const { fieldErrors, clearFieldError, clearAll } = useFieldErrors();

// Seed (or reset) the form each time the dialog opens.
watch(
  () => props.open,
  (open) => {
    if (!open) return;
    clearAll();
    if (props.office) {
      officeForm.designation = props.office.designation;
      officeForm.officeCategoryId = props.office.officeCategoryId;
      officeForm.institutionId = props.office.institutionId;
      officeForm.startDate = props.office.startDate || today();
      officeForm.endDate = props.office.endDate || "";
    } else {
      officeForm.designation = "";
      officeForm.officeCategoryId = null;
      officeForm.institutionId = null;
      officeForm.startDate = today();
      officeForm.endDate = "";
    }
  },
);

function validateOfficeForm(): boolean {
  clearAll();
  if (!officeForm.designation || officeForm.designation.length < 2) {
    fieldErrors.designation = "Designation is required (at least 2 characters)";
  }
  if (!officeForm.officeCategoryId) {
    fieldErrors.officeCategoryId = "Please select a category";
  }
  if (!officeForm.startDate) {
    fieldErrors.startDate = "Start date is required";
  }
  if (officeForm.endDate && officeForm.startDate && officeForm.endDate <= officeForm.startDate) {
    fieldErrors.endDate = "End date must be after start date";
  }
  return Object.keys(fieldErrors).length === 0;
}

function onSubmit() {
  if (!validateOfficeForm()) return;
  emit("submit", {
    designation: officeForm.designation,
    officeCategoryId: officeForm.officeCategoryId!,
    institutionId: officeForm.institutionId,
    startDate: officeForm.startDate,
    endDate: officeForm.endDate,
  });
}

function close() {
  emit("update:open", false);
}
</script>

<template>
  <Dialog :open="open" @update:open="(v) => emit('update:open', v)">
    <DialogScrollContent class="max-w-lg">
      <DialogHeader>
        <DialogTitle>{{ isEditing ? "Edit Office" : "Add Office" }}</DialogTitle>
        <DialogDescription>
          Enter the details of one public office you hold or have held. Each field
          has a help icon if you're unsure what to enter.
        </DialogDescription>
      </DialogHeader>

      <form class="space-y-4" novalidate @submit.prevent="onSubmit">
        <FormField :error="fieldErrors.officeCategoryId" required>
          <template #label>
            Public Office Category
            <HelpTip field-id="profile.category" />
          </template>
          <template #default="{ id, ariaInvalid, ariaDescribedby }">
            <Select
              v-model="officeForm.officeCategoryId"
              @update:model-value="clearFieldError('officeCategoryId')"
            >
              <SelectTrigger
                :id="id"
                :aria-invalid="ariaInvalid"
                :aria-describedby="ariaDescribedby"
                class="w-full"
              >
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="cat in categories"
                  :key="cat.id"
                  :value="cat.id"
                >
                  {{ cat.name }}
                </SelectItem>
              </SelectContent>
            </Select>
          </template>
        </FormField>

        <FormField>
          <template #label>
            Institution
            <HelpTip field-id="profile.institution" />
          </template>
          <template #default="{ id }">
            <Select v-model="officeForm.institutionId">
              <SelectTrigger :id="id" class="w-full">
                <SelectValue placeholder="Select institution (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem :value="null">
                  None
                </SelectItem>
                <SelectItem
                  v-for="inst in institutions"
                  :key="inst.id"
                  :value="inst.id"
                >
                  {{ inst.name }}
                </SelectItem>
              </SelectContent>
            </Select>
          </template>
        </FormField>

        <FormField :error="fieldErrors.designation" required>
          <template #label>
            Designation / Position
            <HelpTip field-id="profile.designation" />
          </template>
          <template #default="{ id, ariaInvalid, ariaDescribedby }">
            <Input
              :id="id"
              v-model="officeForm.designation"
              type="text"
              placeholder="e.g., Deputy Minister, Director, etc."
              :aria-invalid="ariaInvalid"
              :aria-describedby="ariaDescribedby"
              @input="clearFieldError('designation')"
            />
          </template>
        </FormField>

        <fieldset class="space-y-3">
          <legend class="text-sm font-medium text-foreground">
            When did you hold this office?
          </legend>
          <div class="grid grid-cols-2 gap-4">
            <FormField
              required
              :error="fieldErrors.startDate"
            >
              <template #label>
                Date you took up this role
                <HelpTip field-id="profile.officeStartDate" />
              </template>
              <template #default="{ id, ariaDescribedby }">
                <DatePicker
                  :id="id"
                  v-model="officeForm.startDate"
                  block
                  :aria-describedby="ariaDescribedby"
                  @update:model-value="clearFieldError('startDate')"
                />
              </template>
            </FormField>
            <FormField
              hint="Leave blank if you still hold it"
              :error="fieldErrors.endDate"
            >
              <template #label>
                Date you left this role
                <HelpTip field-id="profile.officeEndDate" />
              </template>
              <template #default="{ id, ariaDescribedby }">
                <DatePicker
                  :id="id"
                  v-model="officeForm.endDate"
                  block
                  placeholder="Current"
                  :aria-describedby="ariaDescribedby"
                />
              </template>
            </FormField>
          </div>
        </fieldset>

        <DialogFooter>
          <Button type="button" variant="outline" @click="close">Cancel</Button>
          <Button type="submit" :disabled="saving">
            {{ saving ? "Saving..." : (isEditing ? "Update Office" : "Add Office") }}
          </Button>
        </DialogFooter>
      </form>
    </DialogScrollContent>
  </Dialog>
</template>
