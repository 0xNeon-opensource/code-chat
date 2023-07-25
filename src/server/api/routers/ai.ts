import { ConversationalRetrievalQAChain } from "langchain/chains";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { BufferMemory } from "langchain/memory";

import { TRPCError } from "@trpc/server";
import axios from "axios";
import { LLMChain } from "langchain/chains";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from "langchain/prompts";
import { Configuration, OpenAIApi } from "openai";
import { z } from "zod";
import { run } from "~/playground/chatMemory";
import { test as simpleDocLoader } from "~/playground/simpleDocLoader";
import { streamingLlm } from "~/playground/streamingLlm";
import { getVectorStoreForReactProject, getVectorStoreForStateOfTheUnion } from "~/utils/ingest";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { run2 } from "~/playground/chatMemory2";
import { run3 } from "~/playground/chatMemory3";

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

type Message = {
  role: "user" | "system" | "assistant";
  content: string;
};

const messages: Message[] = [];

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

  chatWithStateOfTheUnion: publicProcedure
    .input(z.object({ prompt: z.string() }))
    .mutation(async ({ input }) => {
      const { prompt } = input;

      messages.push({
        role: "user",
        content: prompt,
      });

      const vectorStore = await getVectorStoreForStateOfTheUnion();

      const fasterModel = new ChatOpenAI({
        modelName: "gpt-3.5-turbo",
      });
      const slowerModel = new ChatOpenAI({
        modelName: "gpt-4",
      });
      const chain = ConversationalRetrievalQAChain.fromLLM(
        slowerModel,
        vectorStore.asRetriever(),
        {
          returnSourceDocuments: true,
          memory: new BufferMemory({
            memoryKey: "chat_history",
            inputKey: "question", // The key for the input to the chain
            outputKey: "text", // The key for the final conversational output of the chain
            returnMessages: true, // If using with a chat model
          }),
          questionGeneratorChainOptions: {
            llm: fasterModel,
          },
        }
      );

      const res = await chain.call({ question: messages.splice(0, messages.length).map((message) => message.content).join("\n") });

      const generatedText = res.text as string;
      console.log('generatedText :>> ', generatedText);

      if (generatedText) {
        messages.push({
          role: "system",
          content: generatedText,
        });
      }


      return {
        generatedText
      }
    }),


  chatWithReactProject: publicProcedure
    .input(z.object({ prompt: z.string() }))
    .mutation(async ({ input }) => {
      const { prompt } = input;

      messages.push({
        role: "user",
        content: prompt,
      });

      const vectorStore = await getVectorStoreForReactProject();

      const fasterModel = new ChatOpenAI({
        modelName: "gpt-3.5-turbo",
      });
      const slowerModel = new ChatOpenAI({
        modelName: "gpt-4",
      });
      const chain = ConversationalRetrievalQAChain.fromLLM(
        slowerModel,
        vectorStore.asRetriever(),
        {
          returnSourceDocuments: true,
          memory: new BufferMemory({
            memoryKey: "chat_history",
            inputKey: "question", // The key for the input to the chain
            outputKey: "text", // The key for the final conversational output of the chain
            returnMessages: true, // If using with a chat model
          }),
          questionGeneratorChainOptions: {
            llm: fasterModel,
          },
        }
      );

      const res = await chain.call({ question: messages.splice(0, messages.length).map((message) => message.content).join("\n") });

      const generatedText = res.text as string;
      console.log('generatedText :>> ', generatedText);

      if (generatedText) {
        messages.push({
          role: "system",
          content: generatedText,
        });
      }


      return {
        generatedText
      }
    }),


  // Doesn't work yet
  generateTextLangchainStreaming: publicProcedure
    .input(z.object({ prompt: z.string() }))
    .mutation(async ({ input }) => {
      const { prompt } = input;

      messages.push({
        role: "user",
        content: prompt,
      });

      const chat = new ChatOpenAI({ temperature: 0, streaming: true });
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
        text: messages.splice(0, messages.length).map((message) => message.content).join("\n")
      }, [
        {
          handleLLMNewToken(token: string) {
            process.stdout.write(token);
          },
        },
      ]);

      console.log('resB :>> ', resB);

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

  reset: publicProcedure.mutation(() => {
    messages.length = 0;
  }),

  testDocumentLoader: publicProcedure.mutation(async () => {
    await simpleDocLoader();
  }),

  testStreamingLlm: publicProcedure.mutation(async () => {
    await streamingLlm();
  }),

  testChatMemory: publicProcedure.mutation(async () => {
    await run();
  }),

  testChatMemory2: publicProcedure.mutation(async () => {
    await run2();
  }),

  testChatMemory3: publicProcedure.mutation(async () => {
    await run3();
  }),

  hello: publicProcedure
    .input(z.object({ text: z.string() }))
    .query(({ input }) => {
      return {
        greeting: `Hello ${input.text}`,
      };
    }),
});
