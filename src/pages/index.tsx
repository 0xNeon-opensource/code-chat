import { type NextPage } from "next";
import Head from "next/head";
import { useCallback, useRef, useState } from "react";
import { ChatContent, type ChatItem } from "../components/ChatContent";
import { ChatInput } from "../components/ChatInput";
import { Header } from "../components/Header";
import { api } from "../utils/api";
import PropagateLoader from "react-spinners/PropagateLoader";
import TestLangChain from "~/components/TestLangChain";

const Home: NextPage = () => {
  const [chatItems, setChatItems] = useState<ChatItem[]>([]);
  const [waiting, setWaiting] = useState<boolean>(false);
  const scrollToRef = useRef<HTMLDivElement>(null);

  // const callHello = api.ai.hello.useQuery({ text: 'Hi its me' });
  // console.log('callHello :>> ', callHello.data?.greeting);

  const scrollToBottom = () => {
    setTimeout(
      () => scrollToRef.current?.scrollIntoView({ behavior: "smooth" }),
      100
    );
  };

  const generatedTextMutation = api.ai.generateTextLangchain.useMutation({
    onSuccess: (data) => {
      setChatItems([
        ...chatItems,
        {
          content: data.generatedText,
          author: "AI",
        },
      ]);
    },

    onError: (error) => {
      setChatItems([
        ...chatItems,
        {
          content: error.message ?? "An error occurred",
          author: "AI",
          isError: true,
        },
      ]);
    },

    onSettled: () => {
      setWaiting(false);
      scrollToBottom();
    },
  });

  const resetMutation = api.ai.reset.useMutation();

  const handleUpdate = (prompt: string) => {
    setWaiting(true);

    setChatItems([
      ...chatItems,
      {
        content: prompt.replace(/\n/g, "\n\n"),
        author: "User",
      },
    ]);

    scrollToBottom();

    console.log('prompt in handleUpdate :>> ', prompt);
    generatedTextMutation.mutate({ prompt });
  };

  const handleReset = () => {
    setChatItems([]);
    resetMutation.mutate();
  };

  return (
    <>
      <Head>
        <title>AI Chat Playground</title>
        <meta name="description" content="AI Chat Playground" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className="flex h-screen flex-col items-center bg-gray-800">
        <section className="w-full">
          <Header />
        </section>

        <section className="w-full flex-grow overflow-y-scroll">
          <ChatContent chatItems={chatItems} />
          <div ref={scrollToRef} />
        </section>


        {waiting && <div className="w-full h-10 py-6 flex items-center place-content-center">
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
