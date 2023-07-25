import { OpenAIEmbeddings } from 'langchain/embeddings/openai'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import { OpenAI } from 'langchain/llms/openai'
import { loadQAStuffChain } from 'langchain/chains'
import { Document } from 'langchain/document'
import { timeout } from 'pineconeConfig'
import { PineconeClient } from '@pinecone-database/pinecone'
import { ChatOpenAI } from 'langchain/chat_models/openai'
import { PineconeStore } from 'langchain/vectorstores/pinecone'


export const getPineconeVectorStore = async (
    client: PineconeClient,
    indexName: string,
) => {
    const pineconeIndex = client.Index(indexName);

    const pineconeVectorStore = await PineconeStore.fromExistingIndex(
        new OpenAIEmbeddings(),
        { pineconeIndex }
    );

    return pineconeVectorStore
}

export const queryVectorStore = async (
    client: PineconeClient,
    indexName: string,
    question: string
) => {
    // 1. Start query process
    console.log('Querying Pinecone vector store...');
    // 2. Retrieve the Pinecone index
    const index = client.Index(indexName);
    // 3. Create query embedding
    const queryEmbedding = await new OpenAIEmbeddings().embedQuery(question)
    // 4. Query Pinecone index and return top 10 matches
    const queryResponse = await index.query({
        queryRequest: {
            topK: 10,
            vector: queryEmbedding,
            includeMetadata: true,
            includeValues: true,
        },
    });
    // 5. Log the number of matches 
    console.log(`Found ${queryResponse.matches.length} matches...`);

    return queryResponse
}

export const queryPineconeVectorStoreAndQueryLLM = async (
    client: PineconeClient,
    indexName: string,
    question: string
) => {

    const queryResponse = await queryVectorStore(client, indexName, question);
    // 6. Log the question being asked
    console.log(`Asking question: ${question}...`);
    if (queryResponse.matches.length) {
        // 7. Create an OpenAI instance and load the QAStuffChain
        const llm = new ChatOpenAI({});
        const chain = loadQAStuffChain(llm);
        // 8. Extract and concatenate page content from matched documents
        const concatenatedPageContent = queryResponse.matches
            .map((match) => match.metadata.pageContent)
            .join(" ");
        // 9. Execute the chain with input documents and question
        const result = await chain.call({
            input_documents: [new Document({ pageContent: concatenatedPageContent })],
            question: question,
        });
        // 10. Log the answer
        console.log(`Answer: ${result.text}`);
        return result.text
    } else {
        // 11. Log that there are no matches, so GPT-3 will not be queried
        console.log('Since there are no matches, GPT-3 will not be queried.');
    }
};

export const createPineconeIndex = async (client: PineconeClient,
    indexName: string,
    vectorDimension: number) => {
    // 1. Initiate index existence check
    console.log(`Checking "${indexName}"...`);
    // 2. Get list of existing indexes
    const existingIndexes = await client.listIndexes();
    // 3. If index doesn't exist, create it
    if (!existingIndexes.includes(indexName)) {
        // 4. Log index creation initiation
        console.log(`Creating "${indexName}"...`);
        // 5. Create index
        await client.createIndex({
            createRequest: {
                name: indexName,
                dimension: vectorDimension,
                metric: 'cosine',
            },
        });
        // 6. Log successful creation
        console.log(`Creating index.... please wait for it to finish initializing.`);
        // 7. Wait for index initialization
        await new Promise((resolve) => setTimeout(resolve, timeout));
    } else {
        // 8. Log if index already exists
        console.log(`"${indexName}" already exists.`);
    }
};

export const updatePinecone = async (
    client: PineconeClient,
    indexName: string,
    docs: Document<Record<string, any>>[]
) => {
    console.log('Retrieving Pinecone index...');
    // 1. Retrieve Pinecone index
    const index = client.Index(indexName);
    // 2. Log the retrieved index name
    console.log(`Pinecone index retrieved: ${indexName}`);
    // 3. Process each document in the docs array
    for (const doc of docs) {
        console.log(`Processing document: ${doc.metadata.source}`);
        const txtPath = doc.metadata.source;
        const text = doc.pageContent;
        // 4. Create RecursiveCharacterTextSplitter instance
        const textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
        });
        console.log('Splitting text into chunks...');
        // 5. Split text into chunks (documents)
        const chunks = await textSplitter.createDocuments([text]);
        console.log(`Text split into ${chunks.length} chunks`);

        const pineconeIndex = client.Index(indexName);

        await PineconeStore.fromDocuments(chunks, new OpenAIEmbeddings(), {
            pineconeIndex,
        });
        console.log('chunk uploaded');

    }
    console.log('✅ Pinecone index updated!');

};