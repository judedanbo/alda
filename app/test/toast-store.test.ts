import { describe, it, expect, beforeEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useToastStore } from "~/stores/toast";
import { toastErrorMessage } from "~/utils/toastError";

beforeEach(() => {
  setActivePinia(createPinia());
});

describe("toastErrorMessage", () => {
  it("joins server formErrors", () => {
    const err = { data: { data: { formErrors: ["Too long", "Bad chars"] } } };
    expect(toastErrorMessage(err)).toBe("Too long. Bad chars");
  });

  it("falls back to data.message then statusMessage", () => {
    expect(toastErrorMessage({ data: { message: "Boom" } })).toBe("Boom");
    expect(toastErrorMessage({ data: { statusMessage: "Nope" } })).toBe("Nope");
  });

  it("uses the provided fallback when nothing matches", () => {
    expect(toastErrorMessage({}, "Custom fallback")).toBe("Custom fallback");
    expect(toastErrorMessage(undefined)).toBe("Something went wrong");
  });
});

describe("useToastStore", () => {
  it("adds a toast with sensible defaults and returns its id", () => {
    const store = useToastStore();
    const id = store.add({ description: "Saved" });
    expect(store.toasts).toHaveLength(1);
    const toast = store.toasts[0]!;
    expect(toast.id).toBe(id);
    expect(toast.variant).toBe("info");
    expect(toast.description).toBe("Saved");
    expect(toast.dismissible).toBe(true);
    expect(toast.count).toBe(1);
  });

  it("prepends newest toasts to the front", () => {
    const store = useToastStore();
    store.add({ description: "first" });
    store.add({ description: "second" });
    expect(store.toasts.map((t) => t.description)).toEqual(["second", "first"]);
  });

  it("dedupes identical toasts by bumping the count instead of stacking", () => {
    const store = useToastStore();
    store.add({ variant: "error", description: "Network error" });
    store.add({ variant: "error", description: "Network error" });
    expect(store.toasts).toHaveLength(1);
    expect(store.toasts[0]!.count).toBe(2);
  });

  it("caps visible toasts and queues the overflow, promoting on dismiss", () => {
    const store = useToastStore();
    const ids = ["a", "b", "c", "d", "e"].map((d) => store.add({ description: d }));
    // MAX_VISIBLE is 4 → the 5th waits in the queue.
    expect(store.toasts).toHaveLength(4);
    expect(store.queue).toHaveLength(1);

    // Dismiss a visible toast → the queued one is promoted.
    store.dismiss(ids[0]!);
    expect(store.toasts).toHaveLength(4);
    expect(store.queue).toHaveLength(0);
  });

  it("updates an existing toast in place (used by promise toasts)", () => {
    const store = useToastStore();
    const id = store.add({ variant: "loading", description: "Saving…", dismissible: false });
    store.update(id, { variant: "success", description: "Saved", dismissible: true });
    const toast = store.toasts[0]!;
    expect(toast.variant).toBe("success");
    expect(toast.description).toBe("Saved");
    expect(toast.dismissible).toBe(true);
  });

  it("re-adding a toast with an explicit existing id updates rather than stacks", () => {
    const store = useToastStore();
    store.add({ id: "fixed", description: "loading" });
    store.add({ id: "fixed", description: "done", variant: "success" });
    expect(store.toasts).toHaveLength(1);
    expect(store.toasts[0]!.description).toBe("done");
    expect(store.toasts[0]!.variant).toBe("success");
  });

  it("clears all toasts", () => {
    const store = useToastStore();
    store.add({ description: "one" });
    store.add({ description: "two" });
    store.clear();
    expect(store.toasts).toHaveLength(0);
    expect(store.queue).toHaveLength(0);
  });

  it("defaults to bottom-right and accepts a new position", () => {
    const store = useToastStore();
    expect(store.position).toBe("bottom-right");
    store.setPosition("top-left");
    expect(store.position).toBe("top-left");
  });
});
