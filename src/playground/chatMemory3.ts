import { ChatOpenAI } from "langchain/chat_models/openai";
import { ConversationChain, ConversationalRetrievalQAChain } from "langchain/chains";
import { HNSWLib } from "langchain/vectorstores/hnswlib";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { BufferMemory, ChatMessageHistory } from "langchain/memory";

import * as fs from "fs";
import { ChatPromptTemplate, HumanMessagePromptTemplate, MessagesPlaceholder, SystemMessagePromptTemplate } from "langchain/prompts";
import { AIChatMessage, HumanChatMessage } from "langchain/schema";

export const run3 = async () => {
    console.log('CHAT MEM 3 STARTED');

    const chatPrompt = ChatPromptTemplate.fromPromptMessages([
        SystemMessagePromptTemplate.fromTemplate(
            "The following is a friendly conversation between a human and an AI. The AI is talkative and provides lots of specific details from its context. If the AI does not know the answer to a question, it truthfully says it does not know."
        ),
        new MessagesPlaceholder("history"),
        HumanMessagePromptTemplate.fromTemplate("{input}"),
    ]);

    const pastMessages = [
        new HumanChatMessage("My name's Jonas"),
        new AIChatMessage("Nice to meet you, Jonas!"),
    ];

    console.log('pastMessages :>> ', pastMessages);

    const memory = new BufferMemory({ returnMessages: true, memoryKey: "history", chatHistory: new ChatMessageHistory(pastMessages) });
    const chain = new ConversationChain(
        {
            llm: new ChatOpenAI(),
            prompt: chatPrompt,
            memory,
        }
    );
    /* Ask it a question */
    const res = await chain.call({ input: 'what is my name' });
    console.log('res :>> ', res);
    console.log('============================');

    const followUpRes = await chain.call({ input: "what does it mean" });
    console.log('followUpRes :>> ', followUpRes);
    console.log('============================');

    console.log('chain.memory :>> ', chain.memory);
};