import { HNSWLib } from "langchain/vectorstores/hnswlib";
import { useCallback, useState } from "react";
import { ErrorResponse, IngestResponse } from "~/pages/api/ingest-data";

const DocumentLoader: React.FC = () => {
    const [vectorStore, setVectorStore] = useState<HNSWLib | undefined>(undefined);

    const loadStateOfTheUnion = useCallback(async () => {
        const res = await fetch('/api/ingest-data');
        if (!res.ok) {
            const errorResponse = (await res.json()) as ErrorResponse;
            console.error('Failed to load vector store:', errorResponse.error);
            return;
        }
        const data = (await res.json()) as IngestResponse;
        console.log('data.vectorStore :>> ', data.vectorStore);
        setVectorStore(data.vectorStore);
    }, [])

    return (<div className="py-6 text-center shadow-2xl">
        <button onClick={loadStateOfTheUnion}>
            Load state of the union
        </button>
    </div>);
}

export default DocumentLoader;