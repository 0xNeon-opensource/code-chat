import { HNSWLib } from 'langchain/vectorstores/hnswlib';
import { NextApiRequest, NextApiResponse } from 'next';
import { getVectorStoreForStateOfTheUnion } from '~/utils/ingest';
import { NextResponse } from 'next/server'
import { PineconeClient } from '@pinecone-database/pinecone'
import { TextLoader } from 'langchain/document_loaders/fs/text'
import { DirectoryLoader } from 'langchain/document_loaders/fs/directory'
import { directory, indexName } from 'pineconeConfig';
import { createPineconeIndex, updatePinecone } from '~/utils/pinecone';

export interface ErrorResponse {
    error: string;
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<NextResponse | ErrorResponse>
) {
    try {
        const loader = new DirectoryLoader(directory, {
            ".txt": (path) => new TextLoader(path),
        })

        const docs = await loader.load()
        const vectorDimensions = 1536

        const client = new PineconeClient()
        await client.init({
            apiKey: process.env.PINECONE_API_KEY || '',
            environment: process.env.PINECONE_ENVIRONMENT || ''
        })

        await createPineconeIndex(client, indexName, vectorDimensions)
        await updatePinecone(client, indexName, docs)

        return NextResponse.json({
            data: 'successfully created index and loaded data into pinecone...'
        })
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
