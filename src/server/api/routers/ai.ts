import { DirectoryLoader } from "langchain/document_loaders/fs/directory";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { HNSWLib } from "langchain/vectorstores/hnswlib";
import { ConversationalRetrievalQAChain } from "langchain/chains";
import { OpenAI } from "langchain/llms/openai";
import { BufferMemory } from "langchain/memory";
import * as fs from "fs";

import { createTRPCRouter, publicProcedure } from "../trpc";
import { z } from "zod";
import { Configuration, OpenAIApi } from "openai";
import { TRPCError } from "@trpc/server";
import axios from "axios";

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

  reset: publicProcedure.mutation(() => {
    messages.length = 0;
  }),

  testDocumentLoader: publicProcedure.mutation(async () => {
    // Load a directory of text files
    const loader = new DirectoryLoader(
      "src/data/codeAsTxtFiles/oneTsFile",
      {
        ".txt": (path) => new TextLoader(path),
      }
    );
    const docs = await loader.load();
    // console.log('docs :>> ', docs);

    // Split the text into chunks
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 0,
    });

    // console.log('splitting...');


    const text = await splitter.splitDocuments(docs);

    // console.log('text :>> ', text);

    const embeddings = new OpenAIEmbeddings();

    // console.log('embeddings :>> ', embeddings);

    // HNSWLib is a local, in-memory vector store
    const vectorStore = await HNSWLib.fromDocuments(text, embeddings);

    // console.log('vectorStore :>> ', vectorStore);

    const model = new OpenAI({});


    const chain = ConversationalRetrievalQAChain.fromLLM(
      model,
      vectorStore.asRetriever(),
      {
        memory: new BufferMemory({
          memoryKey: "chat_history", // Must be set to "chat_history"
        }),
      }
    );

    /* Ask it a question */
    const question = "What is this code about?";
    const res = await chain.call({ question });
    console.log('res :>> ', res);
    /* Ask it a follow up question */
    const followUpRes = await chain.call({
      question: "What was the question I just asked you?",
    });
    console.log('followUpRes :>> ', followUpRes);
  }),

  hello: publicProcedure
    .input(z.object({ text: z.string() }))
    .query(({ input }) => {
      return {
        greeting: `Hello ${input.text}`,
      };
    }),
});
