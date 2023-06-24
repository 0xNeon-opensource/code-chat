import { DirectoryLoader } from "langchain/document_loaders/fs/directory";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { HNSWLib } from "langchain/vectorstores/hnswlib";
import { ConversationalRetrievalQAChain } from "langchain/chains";
import { OpenAI } from "langchain/llms/openai";
import { BufferMemory } from "langchain/memory";
import * as fs from "fs";
import { ChatOpenAI } from "langchain/chat_models/openai";

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
        // questionGeneratorChainOptions: {
        /*
          will use this template to generate a question from the conversation context instead of using the
          question provided in the question parameter.
          This can be useful if the original question does not contain enough information to retrieve a
          suitable answer.
        */
        // template: "This code is part of a cryptocurrency wallet repository.",
        // },
      }
    );

    const fasterModel = new ChatOpenAI({
      modelName: "gpt-3.5-turbo",
    });
    const slowerModel = new ChatOpenAI({
      modelName: "gpt-4",
    });

    const chain2 = ConversationalRetrievalQAChain.fromLLM(
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

    /* Ask it a question */
    const question = "What is this code about?";
    const res = await chain2.call({ question });
    console.log('res :>> ', res);
    /* Ask it a follow up question */
    const followUpRes = await chain2.call({
      question: "What is the repository about?",
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
