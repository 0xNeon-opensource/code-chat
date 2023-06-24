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

export const test = async () => {


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
}