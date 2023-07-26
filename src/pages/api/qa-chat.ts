// import { ChatOpenAI } from "langchain/chat_models";
import { PineconeClient } from "@pinecone-database/pinecone";
import { CallbackManager } from "langchain/callbacks";
import { ConversationalRetrievalQAChain } from "langchain/chains";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { BufferMemory, ChatMessageHistory } from "langchain/memory";
import { AIChatMessage, BaseChatMessage, HumanChatMessage } from "langchain/schema";
import { NextResponse } from "next/server";
import { indexName } from "pineconeConfig";
import { ChatItem } from "~/components/ChatContent";
import { getPineconeVectorStore } from "~/utils/pinecone";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export const config = {
    api: {
        bodyParser: false,
    },
    runtime: "edge",
};

// Be careful about the generator chain rephrasing the question in ways that hurt the end result.

const CUSTOM_QUESTION_GENERATOR_CHAIN_PROMPT_old =
    `Given the following conversation and a follow up question, return the conversation history excerpt that includes any
relevant context to the question if it exists and rephrase the follow up question to be a standalone question.
Most importantly, if the question is not about the context, don't rephrase the question.
If the question is straightforward enough, don't rephrase the question.
Don't change the point of view in narration. If the question is in first person, keep the rephrased question in first person.

Chat History:
{chat_history}
Follow Up Input: {question}
Your answer should follow the following format EXACTLY, only changing the text between the "<" and ">".:
\`\`\`
🤖🤖🤖🤖🤖Use the following pieces of context to answer the users question.
If you don't know the answer, just say that you don't know, don't try to make up an answer.
You absolutely must end each answer with three emojis related to the answer!
----------------
<Relevant chat history excerpt as context here>
🔥🔥🔥🔥🔥 Standalone question: <Rephrased question or original question here>
\`\`\`
Your answer:`;

const CUSTOM_QUESTION_GENERATOR_CHAIN_PROMPT =
    `Given the following conversation and a follow up question, return the conversation history excerpt that includes any
relevant context to the question if it exists and the given question word for word.

Chat History:
{chat_history}
Follow Up Input: {question}
Your answer should follow the following format EXACTLY, only changing the text between the "<" and ">".:
\`\`\`
🤖🤖🤖🤖🤖Use the following pieces of context to answer the users question.
If you don't know the answer, just say that you don't know, don't try to make up an answer.
You absolutely must end each answer with three emojis related to the answer!
----------------
<Relevant chat history excerpt as context here>
🔥🔥🔥🔥🔥 Standalone question: <Original question here>
\`\`\`
Your answer:`;

/*
    LATEST ISSUES:
    - The ConversationalRetrievalQAChain asks the documents only on the first run, does not use the question generator LLM
    - On the second run and on it uses the question generator LLM but does not use the documents (or sometimes doesn't use them, worth double checking)

    What it should do:
    - On each question, it should use the documents and the question generator LLM together.
*/

export default async function handler(req, res) {
    const body = await req.json()

    const chatHistory: BaseChatMessage[] = (body.history as ChatItem[]).map((message) => {
        if (message.author === 'AI') {
            return new AIChatMessage(message.content)
        } else {
            return new HumanChatMessage(message.content);
        }
    })

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
            // temperature: 0.9,
            streaming: true,
            callbackManager: CallbackManager.fromHandlers({
                handleLLMNewToken: async (token) => {
                    // console.log('=============================');
                    // console.log('in handleLLMNewToken');

                    // console.log('token :>> ', token);
                    await writer.ready;
                    await writer.write(encoder.encode(`${token}`));
                },
                handleLLMEnd: async () => {
                    // console.log('=============================');
                    // console.log('in handleLLMEnd');
                    await writer.ready;
                    await writer.close();
                },
                handleLLMError: async (e) => {
                    // console.log('=============================');
                    // console.log('in handleLLMError');
                    await writer.ready;
                    await writer.abort(e);
                },
            }),
        });

        const memory = new BufferMemory({
            memoryKey: "chat_history", // must be chat_history for ConversationalRetrievalQAChain
            inputKey: "question", // The key for the input to the chain
            outputKey: "text", // The key for the final conversational output of the chain
            returnMessages: true,
            chatHistory: new ChatMessageHistory(chatHistory),
        });

        const convoChain = ConversationalRetrievalQAChain.fromLLM(
            streamingModel,
            pineconeVectorStore.asRetriever(),
            {
                returnSourceDocuments: true,
                // qaTemplate: qaTemplate3,
                memory,
                questionGeneratorChainOptions: {
                    llm: nonStreamingModel,
                    template: CUSTOM_QUESTION_GENERATOR_CHAIN_PROMPT,
                },
                verbose: true,
            }
        );


        convoChain
            .call({ question: body.query })
            .then((res) => {
                // console.log('res :>> ', res.sourceDocuments);
                // console.log('res :>> ', res);
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
