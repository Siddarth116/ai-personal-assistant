import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, act } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import SchedulePage from "@/app/schedule/page";
import { ToastProvider } from "@/components/ui/Toast";

vi.mock("next/navigation", () => ({
  usePathname: () => "/schedule",
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

function makeItem(id: string, title: string, isoTime: string) {
  return {
    id,
    type: "EVENT",
    title,
    description: null,
    time: isoTime,
    endTime: isoTime,
    status: "CONFIRMED",
    priority: "MEDIUM",
    timezone: "Asia/Kolkata",
    location: null,
    recurrence: "NONE",
  };
}

describe("SchedulePage - month grid click-through to day view", () => {
  it("shows only the clicked day's items after switching from Month view to Day view", async () => {
    const monthWideItems = Array.from({ length: 15 }, (_, i) =>
      makeItem(`month-${i}`, `Month-wide event ${i}`, "2026-09-01T04:00:00.000Z")
    );
    const singleDayItems = [makeItem("day-1", "THE CORRECT SINGLE DAY EVENT", "2026-09-15T04:00:00.000Z")];

    const fetchMock = vi.fn((url: string) => {
      const u = new URL(url, "http://localhost");
      const start = new Date(u.searchParams.get("start")!).getTime();
      const end = new Date(u.searchParams.get("end")!).getTime();
      const spanDays = (end - start) / (24 * 60 * 60 * 1000);
      const isWideRange = spanDays > 2; // week/month queries span much more than 2 days

      // A real network fetch always takes a tick or more - simulate that
      // with a real setTimeout delay rather than an instantly-resolving
      // promise, so this test can actually observe the gap between React's
      // synchronous render and the fetch resolving, the way a real browser
      // would. An instantly-resolving mock can hide this class of bug.
      return new Promise((resolve) =>
        setTimeout(
          () => resolve({ ok: true, json: async () => ({ items: isWideRange ? monthWideItems : singleDayItems }) } as any),
          10
        )
      );
    });
    global.fetch = fetchMock as any;

    render(
      <ToastProvider>
        <SchedulePage />
      </ToastProvider>
    );

    // Wait for the initial Day-view load to settle.
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(0));

    // Switch to Month view.
    fireEvent.click(screen.getByText("month"));

    // Wait for the month grid to actually render (proves the wide query resolved,
    // not just that it was called - the 10ms mock delay means those differ).
    await waitFor(() => {
      expect(screen.getAllByText("15").length).toBeGreaterThan(0);
    });

    // Click on day "15" in the grid - should exist exactly once in a normal month layout.
    const dayCells = screen.getAllByText("15");
    fireEvent.click(dayCells[0]);

    // Note: this synchronous check cannot reliably prove the absence of a
    // real single-frame flash, since jsdom has no paint pipeline to observe
    // that boundary at (unlike a real browser, where a stale render commits
    // and is visible for one frame before the fix's synchronous items-clear
    // and the async fetch correct it). This is a weaker sanity check, not
    // proof of the fix - see schedule/page.tsx's shift()/selectDayFromGrid()
    // for the actual fix (clearing items synchronously with the
    // anchor/view change, not one render-cycle later inside load()).
    expect(screen.queryByText(/Month-wide event/)).not.toBeInTheDocument();

    // The view toggle should now show "day" as active, and the correct single event should render.
    await waitFor(() => {
      expect(screen.getByText("THE CORRECT SINGLE DAY EVENT")).toBeInTheDocument();
    });

    // The critical assertion: none of the wide month-range items should be visible.
    expect(screen.queryByText(/Month-wide event/)).not.toBeInTheDocument();
  });
});
