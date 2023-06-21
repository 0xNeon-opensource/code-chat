
import { useCallback } from "react";
import { api } from "~/utils/api";

const TestLangChain: React.FC = () => {

    const test = api.ai.testDocumentLoader.useMutation();
    const testDocumentLoader = useCallback(async () => {
        console.log('testing document loader');
        test.mutate();
    }, [test])

    return (
        <button onClick={testDocumentLoader}>Test document loader</button>
    );
}

export default TestLangChain;