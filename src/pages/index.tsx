import { type NextPage } from "next";
import Head from "next/head";
import { useCallback, useRef, useEffect, useState } from "react";
import { ChatContent, type ChatItem } from "../components/ChatContent";
import { ChatInput } from "../components/ChatInput";
import { Header } from "../components/Header";
import PropagateLoader from "react-spinners/PropagateLoader";
import TestLangChain from "~/components/TestLangChain";
import DocumentLoader from "~/components/DocumentLoader";
import { HumanChatMessage, AIChatMessage } from "langchain/schema";

const Home: NextPage = () => {
  const [chatItems, setChatItems] = useState<ChatItem[]>([]);
  const [waiting, setWaiting] = useState<boolean>(false);
  const [hasStreamStarted, setHasStreamStarted] = useState(false);
  const scrollToRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    setTimeout(
      () => scrollToRef.current?.scrollIntoView({ behavior: "smooth" }),
      100
    );
  };

  const handleStreamResponse = async (res: Response) => {
    let buffer = "";
    const textDecoder = new TextDecoder();
    setHasStreamStarted(true)

    const reader = res.body!.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();

        buffer += textDecoder.decode(value, { stream: true });

        if (done) {
          // if the stream is finished, finalize the last message
          setChatItems((chatItems) => [
            ...chatItems.slice(0, chatItems.length - 1), // excluding last item
            {
              // replace last chat item content with the final buffer
              content: buffer.trim(),
              author: "AI",
            },
          ]);
          break;
        } else {
          // if the stream is not finished, update the last message with the current buffer
          setChatItems((chatItems) => [
            ...chatItems.slice(0, chatItems.length - 1), // excluding last item
            {
              // replace last chat item content with updated buffer
              content: buffer,
              author: "AI",
            },
          ]);
          scrollToBottom();
        }
      }
    } catch (error) {
      setChatItems((chatItems) => [
        ...chatItems,
        {
          content: error.message ?? "An error occurred",
          author: "AI",
          isError: true,
        },
      ]);
    } finally {
      setWaiting(false);
      setHasStreamStarted(false)
    }
  }


  const handleUpdate = async (prompt: string) => {
    setWaiting(true);

    setChatItems([
      ...chatItems,
      {
        content: prompt.replace(/\n/g, "\n\n"),
        author: "User",
      },
      {
        content: '', // Placeholder for the incoming AI response
        author: "AI",
      },
    ]);

    scrollToBottom();

    console.log('prompt in handleUpdate :>> ', prompt);
    const res = await fetch("/api/qa-chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: prompt,
        history: chatItems,
      }),
    });

    handleStreamResponse(res);
  };

  const handleReset = () => {
    setChatItems([]);
  };

  return (
    <>
      <Head>
        <title>Dev Shop</title>
        <meta name="description" content="AI Chat Playground" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className="flex h-screen flex-col items-center bg-gray-800">
        <section className="w-full">
          <Header />
        </section>

        <section className="w-full">
          <DocumentLoader />
        </section>

        <section className="w-full flex-grow overflow-y-scroll">
          <ChatContent chatItems={chatItems} />
          <div ref={scrollToRef} />
        </section>


        {waiting && !hasStreamStarted && <div className="w-full h-10 py-6 flex items-center place-content-center">
          <PropagateLoader color="white" />
        </div>}

        <section className="w-full">
          <ChatInput
            onUpdate={handleUpdate}
            onReset={handleReset}
            waiting={waiting}
          />
        </section>

        <TestLangChain />
      </div>
    </>
  );
};

export default Home;
