import type { ChatCompletionTool } from "openai/resources/chat/completions";
import * as eventService from "@/lib/services/eventService";
import * as taskService from "@/lib/services/taskService";
import * as reminderService from "@/lib/services/reminderService";
import * as scheduleService from "@/lib/services/scheduleService";
import { todayRange, upcomingRange } from "@/lib/utils/date";

/**
 * Every tool here is scoped to a single userId, resolved server-side from
 * the authenticated session before the AI ever sees a request. The AI
 * itself never touches the database directly - it only ever calls these
 * functions, which go through the same validated service layer as the
 * regular REST API.
 */

export const toolDefinitions: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "createEvent",
      description: "Create a new calendar event (a meeting, appointment, or scheduled activity with a start and end time).",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Short title of the event" },
          description: { type: "string", description: "Optional longer description" },
          startTime: { type: "string", description: "ISO 8601 date-time with timezone offset, e.g. 2026-09-03T15:00:00+05:30" },
          endTime: { type: "string", description: "ISO 8601 date-time with timezone offset" },
          location: { type: "string", description: "Optional location" },
          priority: { type: "string", enum: [
  "LOW",
  "MEDIUM_LOW",
  "MEDIUM",
  "MEDIUM_HIGH",
  "HIGH",
] },
          status: { type: "string", enum: ["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED"] },
          allDay: { type: "boolean" },
          recurrence: { type: "string", enum: ["NONE", "DAILY", "WEEKLY", "MONTHLY", "YEARLY"] },
        },
        required: ["title", "startTime", "endTime"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listEvents",
      description: "List the user's events, optionally filtered by status or priority.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED"] },
          priority: { type: "string", enum: [
  "LOW",
  "MEDIUM_LOW",
  "MEDIUM",
  "MEDIUM_HIGH",
  "HIGH",
] },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "updateEvent",
      description: "Update an existing event (e.g. change its time, title, status, or location). Requires the event's id - use listEvents or getSchedule first if you don't already have it.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          startTime: { type: "string", description: "ISO 8601 date-time with timezone offset" },
          endTime: { type: "string", description: "ISO 8601 date-time with timezone offset" },
          location: { type: "string" },
          priority: { type: "string", enum: [
  "LOW",
  "MEDIUM_LOW",
  "MEDIUM",
  "MEDIUM_HIGH",
  "HIGH",
] },
          status: { type: "string", enum: ["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED"] },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "deleteEvent",
      description: "Delete an event permanently. This is destructive - confirm with the user before calling this unless they were already explicit and unambiguous about wanting it deleted.",
      parameters: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "createTask",
      description: "Create a new task (something the user needs to do, optionally with a due date).",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          dueAt: { type: "string", description: "ISO 8601 date-time with timezone offset, if the task has a deadline" },
          priority: { type: "string", enum: [
  "LOW",
  "MEDIUM_LOW",
  "MEDIUM",
  "MEDIUM_HIGH",
  "HIGH",
] },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listTasks",
      description: "List the user's tasks, optionally filtered by status or priority.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"] },
          priority: { type: "string", enum: [
  "LOW",
  "MEDIUM_LOW",
  "MEDIUM",
  "MEDIUM_HIGH",
  "HIGH",
] },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "updateTask",
      description: "Update an existing task, including marking it complete or reopening it. Requires the task's id.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          dueAt: { type: "string" },
          status: { type: "string", enum: ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"] },
          priority: { type: "string", enum: [
  "LOW",
  "MEDIUM_LOW",
  "MEDIUM",
  "MEDIUM_HIGH",
  "HIGH",
] },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "deleteTask",
      description: "Delete a task permanently. Confirm with the user first unless they were already explicit.",
      parameters: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "createReminder",
      description: "Create a new reminder - a notification the user wants at a specific time.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          remindAt: { type: "string", description: "ISO 8601 date-time with timezone offset" },
        },
        required: ["title", "remindAt"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listReminders",
      description: "List the user's reminders, optionally filtered by status.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["PENDING", "COMPLETED", "DISMISSED", "CANCELLED"] },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "updateReminder",
      description: "Update an existing reminder, including dismissing or completing it. Requires the reminder's id.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          remindAt: { type: "string" },
          status: { type: "string", enum: ["PENDING", "COMPLETED", "DISMISSED", "CANCELLED"] },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "deleteReminder",
      description: "Delete a reminder permanently. Confirm with the user first unless they were already explicit.",
      parameters: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getSchedule",
      description:
        "Retrieve the user's unified timeline (events + tasks + reminders combined) for an arbitrary date range, in the past, present, or future. Use this for anything like 'what do I have on X', 'what happened last week', 'what's coming up', etc.",
      parameters: {
        type: "object",
        properties: {
          start: { type: "string", description: "ISO 8601 start of range, with timezone offset" },
          end: { type: "string", description: "ISO 8601 end of range, with timezone offset" },
          types: {
            type: "array",
            items: { type: "string", enum: ["EVENT", "TASK", "REMINDER"] },
            description: "Optionally restrict to specific item types",
          },
          status: { type: "string", description: "Optional status filter (valid values differ by type)" },
          priority: { type: "string", enum: [
  "LOW",
  "MEDIUM_LOW",
  "MEDIUM",
  "MEDIUM_HIGH",
  "HIGH",
] },
          search: { type: "string", description: "Optional free-text search across titles/descriptions" },
        },
        required: ["start", "end"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getTodaySchedule",
      description: "Retrieve the user's unified timeline for today only, in their local timezone.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "getUpcomingSchedule",
      description: "Retrieve the user's unified timeline for the next N days (default 7), in their local timezone.",
      parameters: {
        type: "object",
        properties: {
          days: { type: "number", description: "Number of days to look ahead, default 7" },
        },
      },
    },
  },
];

export async function executeTool(
  userId: string,
  timezone: string,
  name: string,
  args: Record<string, any>
): Promise<any> {
  const withTimezone = { ...args, timezone: args.timezone ?? timezone };

  switch (name) {
    case "createEvent":
      return eventService.createEvent(userId, withTimezone as Parameters<typeof eventService.createEvent>[1]);
    case "listEvents":
      return eventService.listEvents(userId, args);
    case "updateEvent":
      return eventService.updateEvent(userId, args.id, args);
    case "deleteEvent":
      await eventService.deleteEvent(userId, args.id);
      return { success: true };

    case "createTask":
      return taskService.createTask(userId, withTimezone as Parameters<typeof taskService.createTask>[1]);
    case "listTasks":
      return taskService.listTasks(userId, args);
    case "updateTask":
      return taskService.updateTask(userId, args.id, args);
    case "deleteTask":
      await taskService.deleteTask(userId, args.id);
      return { success: true };

    case "createReminder":
      return reminderService.createReminder(userId, withTimezone as Parameters<typeof reminderService.createReminder>[1]);
    case "listReminders":
      return reminderService.listReminders(userId, args);
    case "updateReminder":
      return reminderService.updateReminder(userId, args.id, args);
    case "deleteReminder":
      await reminderService.deleteReminder(userId, args.id);
      return { success: true };

    case "getSchedule":
      return scheduleService.getSchedule(userId, args as any);
    case "getTodaySchedule": {
      const range = todayRange(timezone);
      return scheduleService.getSchedule(userId, range);
    }
    case "getUpcomingSchedule": {
      const range = upcomingRange(timezone, args.days ?? 7);
      return scheduleService.getSchedule(userId, range);
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
