
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

    const test3 = api.ai.testChatMemory.useMutation();
    const testChatMemory = useCallback(async () => {
        console.log('testing chat mem');
        test3.mutate();
    }, [test3])

    const testStream = async () => {
        const res = await fetch("/api/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                query: 'write me a lengthy poem about ai',
                history: [],
            }),
        });


        const stream = res.body;
        console.log(stream)

        const reader = stream!.getReader();

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    break;
                }

                const decodedValue = new TextDecoder().decode(value);
                console.log(decodedValue)

            }

        } catch (error) {
            console.error(error);
        }
    }

    return (
        <div className="flex flex-col gap-4">
            <button onClick={testDocumentLoader}>Test document loader</button>
            <button onClick={testStreamingLlm}>Test Streaming LLM</button>
            <button onClick={testChatMemory}>Test Chat Mem</button>
            <button onClick={testStream}>Test Stream 🌊💦💧🚣‍♂️</button>
        </div>
    );
}

export default TestLangChain;