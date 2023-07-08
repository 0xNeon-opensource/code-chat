import { HNSWLib } from "langchain/vectorstores/hnswlib";
import { NextResponse } from "next/server";
import { useCallback, useState } from "react";
import { ErrorResponse, IngestResponse } from "~/pages/api/ingest-data";

const DocumentLoader: React.FC = () => {
    const [vectorStore, setVectorStore] = useState<HNSWLib | undefined>(undefined);

    async function createIndexAndEmbeddings() {
        const res = await fetch('/api/setup-vector');

        if (!res.ok) {
            const errorResponse = (await res.json()) as ErrorResponse;
            console.error('Failed to load vector store:', errorResponse.error);
            return;
        }
        const data = (await res.json()) as NextResponse;
        console.log('data :>> ', data);

    }

    async function queryQA() {
        try {
            const res = await fetch('/api/read-vector', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify('What does this code do?')
            });

            if (!res.ok) {
                const errorResponse = await res.json() as ErrorResponse;
                console.error('Failed to load vector store:', errorResponse.error);
                return;
            }

            const data = await res.json() as NextResponse;
            console.log('data :>> ', data);
        } catch (err) {
            console.error('An error occurred:', err);
        }
    }


    return (<div className="py-6 text-center shadow-2xl">
        <button onClick={createIndexAndEmbeddings} className="border bg-purple-800 text-white">
            create index and embeddings (takes a while)
        </button>
        <br />
        <br />
        <br />
        <button onClick={queryQA} className="border bg-purple-800 text-white">
            query QA with preset question
        </button>
    </div>);
}

export default DocumentLoader;