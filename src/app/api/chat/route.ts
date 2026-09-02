import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { and, eq, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { conversations, messages } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/session";
import { withErrorHandling, NotFoundError, AppError } from "@/lib/utils/apiResponse";
import { isAiConfigured, getOpenAiClient, AI_MODEL } from "@/lib/ai/client";
import { toolDefinitions, executeTool } from "@/lib/ai/tools";
import { buildSystemPrompt } from "@/lib/ai/systemPrompt";
import { nowIso } from "@/lib/utils/date";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

const MAX_TOOL_ITERATIONS = 6;

async function saveMessage(conversationId: string, role: "USER" | "ASSISTANT" | "TOOL", content: string) {
  await db.insert(messages)
    .values({ id: nanoid(), conversationId, role, content, createdAt: nowIso() })
    .run();
}

export const POST = withErrorHandling("chat", async (req: Request) => {
  const user = await requireUser();

  if (!isAiConfigured()) {
    throw new AppError(
      "AI features are not configured. Add an OPENAI_API_KEY to your .env file to enable the assistant.",
      503
    );
  }

  const body = await req.json();
  const { conversationId, message } = body as { conversationId?: string; message: string };

  if (!message || typeof message !== "string" || !message.trim()) {
    throw new AppError("Message is required", 422);
  }

  // Resolve or create the conversation.
  let conversation = conversationId
    ? await db
        .select()
        .from(conversations)
        .where(and(eq(conversations.id, conversationId), eq(conversations.userId, user.id)))
        .get()
    : undefined;

  if (conversationId && !conversation) {
    throw new NotFoundError("Conversation not found");
  }

  if (!conversation) {
    const id = nanoid();
    const now = nowIso();
    const title = message.length > 60 ? message.slice(0, 57) + "..." : message;
    await db.insert(conversations).values({ id, userId: user.id, title, createdAt: now, updatedAt: now }).run();
    conversation = (await db.select().from(conversations).where(eq(conversations.id, id)).get())!;
  }

  await saveMessage(conversation.id, "USER", message);

  // Build the message history for the model from persisted messages.
  const history = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversation.id))
    .orderBy(asc(messages.createdAt))
    .all();

  const chatMessages: ChatCompletionMessageParam[] = [
    { role: "system", content: buildSystemPrompt(user.name, user.timezone) },
    ...history
      .filter((m) => m.role === "USER" || m.role === "ASSISTANT")
      .map((m): ChatCompletionMessageParam => ({
        role: m.role === "USER" ? "user" : "assistant",
        content: m.content,
      })),
  ];

  const client = getOpenAiClient();
  const toolCallLog: Array<{ name: string; args: any; result: any }> = [];

  let finalText = "";

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    let completion;
    try {
      completion = await client.chat.completions.create({
        model: AI_MODEL,
        messages: chatMessages,
        tools: toolDefinitions,
      });
    } catch (err) {
      console.error("[chat] OpenAI API call failed:", err);
      throw new AppError("AI is temporarily unavailable. Please try again in a moment.", 503);
    }

    const choice = completion.choices[0];
    const assistantMsg = choice.message;

    if (assistantMsg.tool_calls && assistantMsg.tool_calls.length > 0) {
      chatMessages.push(assistantMsg);

      for (const toolCall of assistantMsg.tool_calls) {
        let result: any;
        let args: any = {};
        try {
          args = toolCall.function.arguments ? JSON.parse(toolCall.function.arguments) : {};
          result = await executeTool(user.id, user.timezone, toolCall.function.name, args);
        } catch (err) {
          console.error(`[chat] tool execution failed for ${toolCall.function.name}:`, err);
          result = { error: err instanceof Error ? err.message : "Tool execution failed" };
        }
        toolCallLog.push({ name: toolCall.function.name, args, result });
        chatMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      }
      continue; // loop again so the model can respond to tool results
    }

    finalText = assistantMsg.content ?? "";
    break;
  }

  if (!finalText) {
    finalText = "I've done what you asked.";
  }

  await saveMessage(conversation.id, "ASSISTANT", finalText);
  await db.update(conversations).set({ updatedAt: nowIso() }).where(eq(conversations.id, conversation.id)).run();

  return NextResponse.json({
    conversationId: conversation.id,
    reply: finalText,
    toolCalls: toolCallLog,
  });
});
