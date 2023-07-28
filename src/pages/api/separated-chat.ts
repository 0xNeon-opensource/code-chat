import { Document } from 'langchain/document'
// import { ChatOpenAI } from "langchain/chat_models";
import { PineconeClient } from "@pinecone-database/pinecone";
import { CallbackManager } from "langchain/callbacks";
import { ConversationalRetrievalQAChain, LLMChain, loadQAStuffChain } from "langchain/chains";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { BufferMemory, ChatMessageHistory } from "langchain/memory";
import {
    ChatPromptTemplate,
    HumanMessagePromptTemplate,
    SystemMessagePromptTemplate
} from "langchain/prompts";
import { AIMessage, BaseMessage, HumanMessage } from "langchain/schema";
import { NextResponse } from "next/server";
import { indexName } from "pineconeConfig";
import { ChatItem } from "~/components/ChatContent";
import { getPineconeVectorStore, queryVectorStore } from "~/utils/pinecone";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export const config = {
    api: {
        bodyParser: false,
    },
    runtime: "edge",
};

export default async function handler(req, res) {
    const body = await req.json()

    const chatHistory: BaseMessage[] = (body.history as ChatItem[]).map((message) => {
        if (message.author === 'AI') {
            return new AIMessage(message.content)
        } else {
            return new HumanMessage(message.content);
        }
    })


    try {
        if (!OPENAI_API_KEY) {
            throw new Error("OPENAI_API_KEY is not defined.");
        }

        const encoder = new TextEncoder();
        const stream = new TransformStream();
        const writer = stream.writable.getWriter();

        const streamingModel = new ChatOpenAI({
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

        const asyncModel = new ChatOpenAI({
            openAIApiKey: OPENAI_API_KEY,
            temperature: 0.9,
        });

        const client = new PineconeClient()
        await client.init({
            apiKey: process.env.PINECONE_API_KEY || '',
            environment: process.env.PINECONE_ENVIRONMENT || ''
        })

        const queryResponse = await queryVectorStore(client, indexName, body.query);


        const pineconeVectorStore = await getPineconeVectorStore(client, indexName)

        console.log('pineconeVectorStore :>> ', pineconeVectorStore.embeddings);


        (queryResponse?.matches || []).forEach(match => {
            console.log('match.id :>> ', match.id);
            console.log('match.metadata :>> ', match.metadata);
            console.log('match.score :>> ', match.score);
        });

        if (!queryResponse.matches.length) {
            console.error('no matches!!!!!!!!')
            return res.status(500).json({ error: 'no matches' })

        }

        const concatenatedPageContent = queryResponse.matches
            .map((match) => {
                console.log('match :>> ', match);
                return match.metadata.text
            })
            .join(" ");

        console.log('concatenatedPageContent :>> ', concatenatedPageContent);

        const documentsChain = loadQAStuffChain(asyncModel);
        const result = await documentsChain.call({
            input_documents: [new Document({ pageContent: concatenatedPageContent })],
            question: body.query,
        });

        console.log('result :>> ', result);


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
