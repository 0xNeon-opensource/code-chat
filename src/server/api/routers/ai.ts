import { NextResponse } from "next/server";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { LLMChain } from "langchain/chains";
import { CallbackManager } from "langchain/callbacks";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from "langchain/prompts";
import { TRPCError } from "@trpc/server";
import axios from "axios";
import { Configuration, OpenAIApi } from "openai";
import { z } from "zod";
import { test as simpleDocLoader } from "~/playground/simpleDocLoader";
import { streamingLlm } from "~/playground/streamingLlm";
import { createTRPCRouter, publicProcedure } from "../trpc";

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

type Message = {
  role: "user" | "system" | "assistant";
  content: string;
};

const messages: Message[] = [];

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export const aiRouter = createTRPCRouter({
  generateText: publicProcedure
    .input(z.object({ prompt: z.string() }))
    .mutation(async ({ input }) => {
      const { prompt } = input;

      messages.push({
        role: "user",
        content: prompt,
      });

      try {
        const completion = await openai.createChatCompletion({
          model: "gpt-3.5-turbo",
          messages,
        });

        const generatedText = completion.data.choices[0]?.message?.content;

        if (generatedText) {
          messages.push({
            role: completion.data.choices[0]?.message?.role ?? "system",
            content: generatedText,
          });
        }

        return {
          generatedText: generatedText ?? "<no text generated>",
        };
      } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            message: error.response?.data?.error?.message,
          });
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }),

  generateTextLangchain: publicProcedure
    .input(z.object({ prompt: z.string() }))
    .mutation(async ({ input }) => {
      const { prompt } = input;

      messages.push({
        role: "user",
        content: prompt,
      });

      const chat = new ChatOpenAI({ temperature: 0 });
      const chatPrompt = ChatPromptTemplate.fromPromptMessages([
        SystemMessagePromptTemplate.fromTemplate(
          "You are a helpful assistant that responds only in brief rhyming poetry."
        ),
        HumanMessagePromptTemplate.fromTemplate("{text}"),
      ]);

      const chainB = new LLMChain({
        prompt: chatPrompt,
        llm: chat,
      });

      const resB = await chainB.call({
        input_language: "English",
        output_language: "French",
        text: messages.splice(0, messages.length).map((message) => message.content).join("\n")
      });

      const generatedText = resB.text as string;

      if (generatedText) {
        messages.push({
          role: "system",
          content: generatedText,
        });
      }


      return {
        generatedText: resB.text as string,
      }
    }),

  generateTextLangchainStream: publicProcedure
    .input(z.object({ prompt: z.string() }))
    .mutation(async ({ input }) => {
      const { prompt } = input;

      const encoder = new TextEncoder();
      const stream = new TransformStream();
      const writer = stream.writable.getWriter();

      const llm = new ChatOpenAI({
        openAIApiKey: OPENAI_API_KEY,
        temperature: 0.9,
        streaming: true,
        callbackManager: CallbackManager.fromHandlers({
          handleLLMNewToken: async (token) => {
            await writer.ready;
            await writer.write(encoder.encode(`${token}`));
          },
          handleLLMEnd: async () => {
            await writer.ready;
            await writer.close();
          },
          handleLLMError: async (e) => {
            await writer.ready;
            await writer.abort(e);
          },
        }),
      });

      const chatPrompt = ChatPromptTemplate.fromPromptMessages([
        SystemMessagePromptTemplate.fromTemplate(
          "You are a helpful assistant that answers questions as best you can."
        ),
        HumanMessagePromptTemplate.fromTemplate("{input}"),
      ]);
      const chain = new LLMChain({
        prompt: chatPrompt,
        llm: llm,
      });
      chain
        // .call({input: body.query})
        .call({ input: prompt })
        .catch(console.error);

      console.log('stream.readable :>> ', stream.readable);

      return new NextResponse(stream.readable, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
        },
      });

    }),

  reset: publicProcedure.mutation(() => {
    messages.length = 0;
  }),

  testDocumentLoader: publicProcedure.mutation(async () => {
    await simpleDocLoader();
  }),

  testStreamingLlm: publicProcedure.mutation(async () => {
    await streamingLlm();
  }),

  hello: publicProcedure
    .input(z.object({ text: z.string() }))
    .query(({ input }) => {
      return {
        greeting: `Hello ${input.text}`,
      };
    }),
});
