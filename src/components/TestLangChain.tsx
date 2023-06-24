
import { useCallback } from "react";
import { api } from "~/utils/api";

const TestLangChain: React.FC = () => {

    const test = api.ai.testDocumentLoader.useMutation();
    const testDocumentLoader = useCallback(async () => {
        console.log('testing document loader');
        test.mutate();
    }, [test])

    const test2 = api.ai.testStreamingLlm.useMutation();
    const testStreamingLlm = useCallback(async () => {
        console.log('testing streaming llm');
        test2.mutate();
    }, [test2])

    return (
        <div className="flex flex-col gap-4">
            <button onClick={testDocumentLoader}>Test document loader</button>
            <button onClick={testStreamingLlm}>Test Streaming LLM</button>
        </div>
    );
}

export default TestLangChain;