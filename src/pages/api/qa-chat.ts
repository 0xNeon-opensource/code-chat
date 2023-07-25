// import { ChatOpenAI } from "langchain/chat_models";
import { NextResponse } from "next/server";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { ConversationalRetrievalQAChain, LLMChain, RetrievalQAChain, loadQAStuffChain } from "langchain/chains";
import { CallbackManager } from "langchain/callbacks";
import {
    ChatPromptTemplate,
    HumanMessagePromptTemplate,
    PromptTemplate,
    SystemMessagePromptTemplate,
} from "langchain/prompts";
import { HumanChatMessage, SystemChatMessage, AIChatMessage } from "langchain/schema";
import { getPineconeVectorStore, queryVectorStore } from "~/utils/pinecone";
import { PineconeClient } from "@pinecone-database/pinecone";
import { indexName } from "pineconeConfig";
import { Document } from 'langchain/document'
import { PineconeStore } from "langchain/vectorstores/pinecone";
import { PineconeTranslator } from "langchain/retrievers/self_query/pinecone";
import { BufferMemory, ChatMessageHistory } from "langchain/memory";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export const config = {
    api: {
        bodyParser: false,
    },
    runtime: "edge",
};


export default async function handler(req, res) {
    const body = await req.json()

    console.log('body :>> ', body);

    try {
        if (!OPENAI_API_KEY) {
            throw new Error("OPENAI_API_KEY is not defined.");
        }

        const client = new PineconeClient()
        await client.init({
            apiKey: process.env.PINECONE_API_KEY || '',
            environment: process.env.PINECONE_ENVIRONMENT || ''
        })

        const pineconeVectorStore = await getPineconeVectorStore(client, indexName)

        const encoder = new TextEncoder();
        const stream = new TransformStream();
        const writer = stream.writable.getWriter();

        const nonStreamingModel = new ChatOpenAI({});

        const streamingModel = new ChatOpenAI({
            openAIApiKey: OPENAI_API_KEY,
            temperature: 0.9,
            streaming: true,
            callbackManager: CallbackManager.fromHandlers({
                handleLLMNewToken: async (token) => {
                    console.log('=============================');
                    console.log('in handleLLMNewToken');

                    console.log('token :>> ', token);
                    await writer.ready;
                    await writer.write(encoder.encode(`${token}`));
                },
                handleLLMEnd: async () => {
                    console.log('=============================');
                    console.log('in handleLLMEnd');
                    await writer.ready;
                    await writer.close();
                },
                handleLLMError: async (e) => {
                    console.log('=============================');
                    console.log('in handleLLMError');
                    await writer.ready;
                    await writer.abort(e);
                },
            }),
        });

        const qaTemplate = `Use the following pieces of context to answer the question at the end.
        If you don't know the answer, just say "Sorry I dont know, I am learning from Aliens 🙃👽", don't try to make up an answer.
        At the end of every answer, write three poop emojis no matter what.
        {chat_history}

        Human: {question}
        AI:`;

        const pastMessages = [
            new HumanChatMessage("My name's Jonas"),
            new AIChatMessage("Nice to meet you, Jonas!"),
        ];

        const memory = new BufferMemory({
            memoryKey: "chat_history", // must be chat_history for ConversationalRetrievalQAChain
            // inputKey: "question",
            // outputKey: "text",
            returnMessages: true,
            chatHistory: new ChatMessageHistory(pastMessages),
        });

        const convoChain = ConversationalRetrievalQAChain.fromLLM(
            streamingModel,
            pineconeVectorStore.asRetriever(),
            {
                // returnSourceDocuments: true,
                qaTemplate,
                memory,
                questionGeneratorChainOptions: {
                    llm: nonStreamingModel,
                },
            }
        );

        convoChain
            .call({ question: body.query })
            .then((res) => {
                // console.log('res :>> ', res.sourceDocuments);
                console.log('res :>> ', res);
            })
            .catch(console.error);


        return new NextResponse(stream.readable, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
            },
        });
    } catch (error) {
        // console.error(error);
        // res.status(500).send("Internal Server Error");
        return new Response(
            JSON.stringify(
                { error: error.message },
                {
                    status: 500,
                    headers: { "Content-Type": "application/json" },
                }
            )
        );
    }
}
