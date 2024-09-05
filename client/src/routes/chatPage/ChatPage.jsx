import React from "react";
import "./chatPage.css";
import NewPrompt from "../../components/newPrompt/NewPrompt";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import Markdown from "react-markdown";
import { IKImage } from "imagekitio-react";

const ChatPage = () => {
  const path = useLocation().pathname;
  const chatId = path.split("/").pop();

  const fetchWithRetry = async (url, options, retries = 3) => {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        if (response.status === 429 && retries > 0) {
          // Wait for a while before retrying
          const retryAfter = response.headers.get("Retry-After") || 1;
          await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
          return fetchWithRetry(url, options, retries - 1);
        } else {
          throw new Error(`Request failed with status ${response.status}`);
        }
      }
      return response.json();
    } catch (error) {
      console.error("Error making request:", error);
      throw error;
    }
  };

  const { isPending, error, data } = useQuery({
    queryKey: ["chat", chatId],
    queryFn: () =>
      fetchWithRetry(`${import.meta.env.VITE_API_URL}/api/chats/${chatId}`, {
        credentials: "include",
      }),
  });

  console.log(data);

  return (
    <div className="chatPage">
      <div className="wrapper">
        <div className="chat">
          {isPending
            ? "Loading..."
            : error
            ? "Something went wrong!"
            : data?.history?.map((message, index) => (
                <div key={index}>
                  {message.img && (
                    <IKImage
                      urlEndpoint={import.meta.env.VITE_IMAGE_KIT_ENDPOINT}
                      path={message.img}
                      height="300"
                      width="400"
                      transformation={[{ height: 300, width: 400 }]}
                      loading="lazy"
                      lqip={{ active: true, quality: 20 }}
                    />
                  )}
                  <div
                    className={
                      message.role === "user" ? "message user" : "message"
                    }
                  >
                    <Markdown>{message.parts[0].text}</Markdown>
                  </div>
                </div>
              ))}

          {data && <NewPrompt data={data} />}
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
