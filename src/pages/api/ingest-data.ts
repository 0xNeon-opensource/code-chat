import { HNSWLib } from 'langchain/vectorstores/hnswlib';
import { NextApiRequest, NextApiResponse } from 'next';
import { getVectorStoreForStateOfTheUnion } from '~/utils/ingest';

export interface IngestResponse {
    vectorStore: HNSWLib;
}

export interface ErrorResponse {
    error: string;
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<IngestResponse | ErrorResponse>
) {
    try {
        const vectorStoreStateOfTheUnion = await getVectorStoreForStateOfTheUnion();

        res.status(200).json({
            vectorStore: vectorStoreStateOfTheUnion,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
