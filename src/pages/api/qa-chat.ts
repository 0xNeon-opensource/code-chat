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
import { HumanChatMessage, SystemChatMessage } from "langchain/schema";
import { getPineconeVectorStore, queryVectorStore } from "~/utils/pinecone";
import { PineconeClient } from "@pinecone-database/pinecone";
import { indexName } from "pineconeConfig";
import { Document } from 'langchain/document'
import { PineconeStore } from "langchain/vectorstores/pinecone";
import { PineconeTranslator } from "langchain/retrievers/self_query/pinecone";
import { BufferMemory } from "langchain/memory";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export const config = {
    api: {
        bodyParser: false,
    },
    runtime: "edge",
};

const memory = new BufferMemory({
    memoryKey: "chat_history",
    returnMessages: true,
});

export default async function handler(req, res) {
    const body = await req.json()

    try {
        if (!OPENAI_API_KEY) {
            throw new Error("OPENAI_API_KEY is not defined.");
        }

        const client = new PineconeClient()
        await client.init({
            apiKey: process.env.PINECONE_API_KEY || '',
            environment: process.env.PINECONE_ENVIRONMENT || ''
        })

        const queryResponse = await queryVectorStore(client, indexName, body.query);


        const pineconeVectorStore = await getPineconeVectorStore(client, indexName)

        // (queryResponse?.matches || []).forEach(match => {
        //     console.log('match.id :>> ', match.id);
        //     console.log('match.metadata :>> ', match.metadata);
        //     console.log('match.score :>> ', match.score);
        // });

        if (!queryResponse.matches.length) {
            console.error('no matches!!!!!!!!')
            return res.status(500).json({ error: 'no matches' })

        }

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

        // const chain = new LLMChain({ prompt, llm });
        // chain.call({ query: query }).catch(console.error);

        // We can also construct an LLMChain from a ChatPromptTemplate and a chat model.
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



        // 8. Extract and concatenate page content from matched documents
        const concatenatedPageContent = queryResponse.matches
            .map((match) => match.metadata.pageContent)
            .join(" ");
        // 9. Execute the chain with input documents and question
        const chain2 = loadQAStuffChain(llm);
        // chain2.call({
        //     input_documents: [new Document({ pageContent: concatenatedPageContent })],
        //     question: body.query,
        // });

        const qa_template = `Use the following pieces of context to answer the question at the end. If you don't know the answer, just say "Sorry I dont know, I am learning from Aliens", don't try to make up an answer.
  {context}

  Question: {question}
  Helpful Answer:`;

        const convoChain = ConversationalRetrievalQAChain.fromLLM(
            llm,
            pineconeVectorStore.asRetriever(),
            {
                returnSourceDocuments: true,
            }
        );

        convoChain
            .call({ question: body.query, chat_history: [] })
            .then((res) => {
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
