<script setup lang="ts">
definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

interface Category {
  id: number;
  name: string;
  description: string | null;
  articleReference: string | null;
  isActive: boolean;
}

const categories = ref<Category[]>([]);
const loading = ref(true);

const showModal = ref(false);
const isEditing = ref(false);
const saving = ref(false);
const errorMessage = ref("");
const { fieldErrors, clearFieldError, clearAll: clearFieldErrors } = useFieldErrors();

const formData = ref({
  id: 0,
  name: "",
  description: "",
  articleReference: "",
  isActive: true,
});

const fetchCategories = async () => {
  loading.value = true;
  try {
    const response = await authFetch<any>(
      "/api/admin/categories?includeInactive=true",
    );

    if (response.success) {
      categories.value = response.data;
    }
  } catch (error) {
    console.error("Failed to fetch categories:", error);
  } finally {
    loading.value = false;
  }
};

await fetchCategories();

const openCreateModal = () => {
  isEditing.value = false;
  errorMessage.value = "";
  clearFieldErrors();
  formData.value = {
    id: 0,
    name: "",
    description: "",
    articleReference: "",
    isActive: true,
  };
  showModal.value = true;
};

const openEditModal = (category: Category) => {
  isEditing.value = true;
  errorMessage.value = "";
  clearFieldErrors();
  formData.value = {
    id: category.id,
    name: category.name,
    description: category.description || "",
    articleReference: category.articleReference || "",
    isActive: category.isActive,
  };
  showModal.value = true;
};

const closeModal = () => {
  showModal.value = false;
  errorMessage.value = "";
  clearFieldErrors();
  formData.value = {
    id: 0,
    name: "",
    description: "",
    articleReference: "",
    isActive: true,
  };
};

const saveCategory = async () => {
  errorMessage.value = "";
  clearFieldErrors();

  if (!formData.value.name.trim()) {
    fieldErrors.name = "Category name is required";
    return;
  }

  saving.value = true;
  try {
    if (isEditing.value) {
      await authFetch(`/api/admin/categories/${formData.value.id}`, {
        method: "PUT",
        body: {
          name: formData.value.name,
          description: formData.value.description || null,
          articleReference: formData.value.articleReference || null,
          isActive: formData.value.isActive,
        },
      });
    } else {
      await authFetch("/api/admin/categories", {
        method: "POST",
        body: {
          name: formData.value.name,
          description: formData.value.description || null,
          articleReference: formData.value.articleReference || null,
        },
      });
    }
    await fetchCategories();
    closeModal();
  } catch (error: unknown) {
    const err = error as { data?: { message?: string }; statusMessage?: string };
    errorMessage.value =
      err.data?.message || err.statusMessage || "Failed to save category";
  } finally {
    saving.value = false;
  }
};

const toggleStatus = async (category: Category) => {
  try {
    if (category.isActive) {
      await authFetch(`/api/admin/categories/${category.id}`, {
        method: "DELETE",
      });
      category.isActive = false;
    } else {
      await authFetch(`/api/admin/categories/${category.id}`, {
        method: "PUT",
        body: {
          isActive: true,
        },
      });
      category.isActive = true;
    }
  } catch (error) {
    console.error("Failed to toggle category status:", error);
  }
};
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Public Office Categories"
      description="Manage public office categories for Article 286 declarations"
    >
      <template #actions>
        <Button @click="openCreateModal">Add Category</Button>
      </template>
    </PageHeader>

    <!-- Loading -->
    <div v-if="loading" class="space-y-3">
      <Skeleton v-for="i in 5" :key="i" class="h-12 w-full rounded-lg" />
    </div>

    <!-- Categories Table -->
    <Card v-else>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Article Reference</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-if="categories.length === 0">
            <TableCell colspan="5" class="text-center py-8 text-muted-foreground">
              No categories found
            </TableCell>
          </TableRow>
          <TableRow v-for="category in categories" :key="category.id">
            <TableCell>
              <p class="text-sm font-medium text-foreground">{{ category.name }}</p>
            </TableCell>
            <TableCell class="text-sm text-muted-foreground">
              {{ category.articleReference || "-" }}
            </TableCell>
            <TableCell class="text-sm text-muted-foreground max-w-xs truncate">
              {{ category.description || "-" }}
            </TableCell>
            <TableCell>
              <Badge :class="category.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'">
                {{ category.isActive ? "Active" : "Inactive" }}
              </Badge>
            </TableCell>
            <TableCell>
              <div class="flex items-center gap-2">
                <Button variant="outline" size="sm" @click="openEditModal(category)">
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  :class="category.isActive ? 'text-red-600 hover:text-red-700' : 'text-green-600 hover:text-green-700'"
                  @click="toggleStatus(category)"
                >
                  {{ category.isActive ? "Deactivate" : "Activate" }}
                </Button>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </Card>

    <!-- Create/Edit Modal -->
    <Dialog :open="showModal" @update:open="(v: boolean) => { if (!v) closeModal() }">
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle>{{ isEditing ? "Edit Category" : "Add Category" }}</DialogTitle>
        </DialogHeader>

        <Alert v-if="errorMessage" variant="destructive">
          <AlertDescription>{{ errorMessage }}</AlertDescription>
        </Alert>

        <div class="space-y-4">
          <div class="space-y-2">
            <Label for="cat-name">
              Name <span class="text-red-500">*</span>
            </Label>
            <Input
              id="cat-name"
              v-model="formData.name"
              type="text"
              placeholder="Category name"
              :class="{ 'border-destructive': fieldErrors.name }"
              @input="clearFieldError('name')"
            />
            <p v-if="fieldErrors.name" class="text-xs text-destructive">
              {{ fieldErrors.name }}
            </p>
          </div>

          <div>
            <Label for="cat-article">Article Reference</Label>
            <Input
              id="cat-article"
              v-model="formData.articleReference"
              type="text"
              placeholder="e.g. Article 286(1)(a)"
              maxlength="50"
              class="mt-1"
            />
          </div>

          <div>
            <Label for="cat-desc">Description</Label>
            <Textarea
              id="cat-desc"
              v-model="formData.description"
              placeholder="Brief description of this category"
              :rows="3"
              maxlength="500"
              class="mt-1"
            />
          </div>

          <div v-if="isEditing" class="flex items-center gap-2">
            <input
              id="cat-active"
              v-model="formData.isActive"
              type="checkbox"
              class="w-4 h-4"
            />
            <Label for="cat-active">Active</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="closeModal">Cancel</Button>
          <Button :disabled="saving || !formData.name" @click="saveCategory">
            {{ saving ? "Saving..." : isEditing ? "Update" : "Create" }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
