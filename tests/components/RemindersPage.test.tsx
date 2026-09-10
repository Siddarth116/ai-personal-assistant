import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import RemindersPage from "@/app/reminders/page";
import { ToastProvider } from "@/components/ui/Toast";

vi.mock("next/navigation", () => ({
  usePathname: () => "/reminders",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/components/layout/SessionProvider", () => ({
  useSession: () => ({
    user: {
      id: "u1",
      name: "Test User",
      email: "test@example.com",
      timezone: "Asia/Kolkata",
      hourFormat: 24,
      weekStartsOn: "MONDAY",
      theme: "system",
    },
    aiConfigured: false,
    loading: false,
    refresh: vi.fn(),
  }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("RemindersPage - overdue reminders", () => {
  it("shows a PENDING reminder whose time has already passed, under an Overdue section - regression test for the reported bug", async () => {
    const pastReminder = {
      id: "r1",
      title: "This one is overdue",
      description: null,
      remindAt: "2020-01-01T00:00:00.000Z", // long in the past, still PENDING
      timezone: "Asia/Kolkata",
      status: "PENDING",
      priority: "MEDIUM",
    };
    const futureReminder = {
      id: "r2",
      title: "This one is upcoming",
      description: null,
      remindAt: "2099-01-01T00:00:00.000Z",
      timezone: "Asia/Kolkata",
      status: "PENDING",
      priority: "MEDIUM",
    };

    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({ reminders: [pastReminder, futureReminder] }),
      })
    ) as any;

    render(
      <ToastProvider>
        <RemindersPage />
      </ToastProvider>
    );

    // Before the fix, the overdue reminder would never render anywhere at all.
    await waitFor(() => {
      expect(screen.getByText("This one is overdue")).toBeInTheDocument();
    });
    expect(screen.getByText("Overdue")).toBeInTheDocument();
    expect(screen.getByText("This one is upcoming")).toBeInTheDocument();
  });
});
