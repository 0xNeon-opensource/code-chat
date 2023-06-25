import * as fs from "fs";
import { DirectoryLoader } from "langchain/document_loaders/fs/directory";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { HNSWLib } from "langchain/vectorstores/hnswlib";

export const getVectorStoreForStateOfTheUnion = async () => {
    const text = fs.readFileSync("src/playground/state_of_the_union.txt", "utf8");
    const textSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000 });
    const docs = await textSplitter.createDocuments([text]);
    const vectorStore = await HNSWLib.fromDocuments(docs, new OpenAIEmbeddings());
    return vectorStore;
}

export const getVectorStoreForReactProject = async () => {
    const loader = new DirectoryLoader(
        "src/data/codeAsTxtFiles/oneTsFile",
        {
            ".txt": (path) => new TextLoader(path),
        }
    );
    const docs = await loader.load();

    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 0,
    });


    const text = await splitter.splitDocuments(docs);

    const embeddings = new OpenAIEmbeddings();

    // HNSWLib is a local, in-memory vector store
    const vectorStore = await HNSWLib.fromDocuments(text, embeddings);

    return vectorStore;
}