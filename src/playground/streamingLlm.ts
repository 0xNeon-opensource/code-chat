import { ChatOpenAI } from "langchain/chat_models/openai";
import { ConversationalRetrievalQAChain } from "langchain/chains";
import { HNSWLib } from "langchain/vectorstores/hnswlib";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { BufferMemory } from "langchain/memory";

import * as fs from "fs";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export const streamingLlm = async () => {
    if (!OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY is not defined.");
    }
};