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

    // Doesn't need tobe a langchain chat history type if we're just putting it into our own prompt
    // const chatHistory: BaseMessage[] = (body.history as ChatItem[]).map((message) => {
    //     if (message.author === 'AI') {
    //         return new AIMessage(message.content)
    //     } else {
    //         return new HumanMessage(message.content);
    //     }
    // })

    const chatHistoryList: string[] = [] as string[]

    (body.history as ChatItem[]).forEach((message) => {
        if (message.author === 'AI') {
            chatHistoryList.push('AI:' + message.content)
        } else {
            chatHistoryList.push('HUMAN:' + message.content)
            return new HumanMessage(message.content);
        }
    })

    console.log('chatHistoryList :>> ', chatHistoryList);

    const chatHistory = chatHistoryList.join('\n')

    console.log('chatHistory :>> ', chatHistory);

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

        const inputDocuments = [] as Document[]
        (queryResponse?.matches || []).forEach(match => {
            // console.log('match.id :>> ', match.id);
            // console.log('match.metadata :>> ', match.metadata);
            // console.log('match.score :>> ', match.score);
            inputDocuments.push(new Document({ pageContent: match.metadata.text, metadata: { test: '🔥🔥🔥🔥🔥🔥' } }))
        });

        if (!queryResponse.matches.length) {
            console.error('no matches!!!!!!!!')
            return res.status(500).json({ error: 'no matches' })

        }

        // temporarily just make all documents one big text
        const concatenatedPageContent = queryResponse.matches
            .map((match) => match.metadata.text)
            .join(" ");


        const chatPrompt = ChatPromptTemplate.fromPromptMessages([
            SystemMessagePromptTemplate.fromTemplate(
                `
                Use the following pieces of context to answer the user's question.
                If you don't know the answer, just say that you don't know, don't try to make up an answer.
                You absolutely must end each answer with three emojis related to the answer!
                You must answer the user's question as if you were speaking directly to them.


            ===============
            CHAT HISTORY:
            {chatHistory}
            ===============
            RELEVENT DOCUMENTS:
            {inputDocuments}
            ===============
            QUESTION:
            {question}
            ===============
            ANSWER:
              `
            ),
            // HumanMessagePromptTemplate.fromTemplate("{chatHistory}"),
        ]);

        const documentsChain = new LLMChain({
            llm: streamingModel,
            prompt: chatPrompt,
            verbose: true
        });
        // const documentsChain = loadQAStuffChain(streamingModel, { verbose: true });
        documentsChain.call({
            chatHistory,
            inputDocuments: concatenatedPageContent,
            question: body.query,
        });

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
