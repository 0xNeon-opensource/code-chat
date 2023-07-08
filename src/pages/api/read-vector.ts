import { PineconeClient } from '@pinecone-database/pinecone';
import { NextApiRequest, NextApiResponse } from 'next';
import { NextResponse } from 'next/server';
import { indexName } from 'pineconeConfig';
import { queryPineconeVectorStoreAndQueryLLM } from '~/utils/pinecone';

export interface ErrorResponse {
    error: string;
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<NextResponse | ErrorResponse>
) {
    try {
        const body = await req.body
        const client = new PineconeClient()
        await client.init({
            apiKey: process.env.PINECONE_API_KEY || '',
            environment: process.env.PINECONE_ENVIRONMENT || ''
        })

        const text = await queryPineconeVectorStoreAndQueryLLM(client, indexName, body)

        return res.status(200).json({
            data: text
        })
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
