import { ChatOpenAI } from "langchain/chat_models/openai";
import { ConversationChain, ConversationalRetrievalQAChain } from "langchain/chains";
import { HNSWLib } from "langchain/vectorstores/hnswlib";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { BufferMemory } from "langchain/memory";

import * as fs from "fs";
import { ChatPromptTemplate, HumanMessagePromptTemplate, MessagesPlaceholder, SystemMessagePromptTemplate } from "langchain/prompts";

export const run2 = async () => {
    console.log('CHAT MEM 222 STARTED');

    const vectorStore = await HNSWLib.fromDocuments([], new OpenAIEmbeddings());
    const slowerModel = new ChatOpenAI({
        modelName: "gpt-4",
    });

    const chatPrompt = ChatPromptTemplate.fromPromptMessages([
        SystemMessagePromptTemplate.fromTemplate(
            "The following is a friendly conversation between a human and an AI. The AI is talkative and provides lots of specific details from its context. If the AI does not know the answer to a question, it truthfully says it does not know."
        ),
        new MessagesPlaceholder("history"),
        HumanMessagePromptTemplate.fromTemplate("{input}"),
    ]);

    const chain = new ConversationChain(
        {
            llm: slowerModel,
            prompt: chatPrompt,
            memory: new BufferMemory({ returnMessages: true, memoryKey: "history" }),
        }
    );
    /* Ask it a question */
    const res = await chain.call({ input: 'my favorite color is blue' });
    console.log('res :>> ', res);
    console.log('============================');

    const followUpRes = await chain.call({ input: "what's my favorite color?" });
    console.log('followUpRes :>> ', followUpRes);
    console.log('============================');

    console.log('chain.memory :>> ', chain.memory);
};