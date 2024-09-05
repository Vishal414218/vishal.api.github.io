import { useEffect, useRef, useState } from "react";
import "./newPrompt.css";
import Upload from "../upload/Upload";
import { IKImage } from "imagekitio-react";
import model from "../../lib/gemini";
import Markdown from "react-markdown";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const NewPrompt = ({ data }) => {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]); // Array of question-answer objects
  const [img, setImg] = useState({
    isLoading: false,
    error: "",
    dbData: {},
    aiData: {},
  });

  const chat = useRef(
    model.startChat({
      history:
        data?.history.map(({ role, parts }) => ({
          role,
          parts: [{ text: parts[0]?.text || "" }],
        })) || [],
      generationConfig: {
        // maxOutputTokens: 100,
      },
    })
  ).current;

  const endRef = useRef(null);
  const formRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, img.dbData]);

  const queryClient = useQueryClient();

  const fetchWithRetry = async (url, options, retries = 3, delay = 1000) => {
    try {
      const res = await fetch(url, options);
      const contentType = res.headers.get("Content-Type") || "";
      const text = await res.text(); // Get the response as text

      if (!res.ok) {
        if (res.status === 429 && retries > 0) {
          const retryAfter = res.headers.get("Retry-After") || delay;
          await new Promise((resolve) => setTimeout(resolve, retryAfter));
          return fetchWithRetry(url, options, retries - 1, delay * 2);
        } else {
          throw new Error(`Failed to update chat: ${text}`);
        }
      }

      if (contentType.includes("application/json")) {
        try {
          return JSON.parse(text);
        } catch (parseError) {
          console.error("Failed to parse JSON response:", text);
          throw parseError;
        }
      } else {
        console.log("Non-JSON response received:", text);
        return text;
      }
    } catch (error) {
      console.error("Error in fetchWithRetry:", error.message);
      throw error;
    }
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const body = JSON.stringify({
        question: question || undefined,
        answer: messages[messages.length - 1]?.answer || "",
        img: img.dbData?.filePath || undefined,
      });

      const response = await fetchWithRetry(
        `${import.meta.env.VITE_API_URL}/api/chats/${data._id}`,
        {
          method: "PUT",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body,
        }
      );

      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat", data._id] }).then(() => {
        formRef.current?.reset();
        setQuestion("");
        setImg({
          isLoading: false,
          error: "",
          dbData: {},
          aiData: {},
        });
      });
    },
    onError: (err) => {
      console.error("Mutation error:", err.message);
      console.error("Full error object:", err);
    },
  });

  const add = async (text, isInitial) => {
    if (!isInitial) setQuestion(text);

    try {
      const result = await chat.sendMessageStream(
        Object.keys(img.aiData).length ? [img.aiData, text] : [text]
      );

      let accumulatedText = "";
      for await (const chunk of result.stream) {
        const chunkText = await chunk.text();
        accumulatedText += chunkText;
      }

      const newMessage = {
        question: text,
        answer: accumulatedText,
        imgFilePath: img.dbData.filePath,
      };

      // Only update the messages state if this message is not a duplicate
      setMessages((prevMessages) => {
        if (
          prevMessages.some(
            (msg) => msg.question === newMessage.question && msg.answer === newMessage.answer
          )
        ) {
          return prevMessages; // Avoid adding duplicate
        }
        return [...prevMessages, newMessage];
      });

      mutation.mutate();
    } catch (err) {
      console.error("Error sending message:", err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const text = e.target.text.value.trim();
    if (!text) return;
    add(text, false);
  };

  useEffect(() => {
    if (data?.history?.length === 1) {
      add(data.history[0]?.parts[0]?.text || "", true);
    }
  }, [data]);

  return (
    <>
      {img.isLoading && <div className="loading">Loading...</div>}
      {messages.map((msg, index) => (
        <div key={index}>
          <div className="message user">{msg.question}</div>
          <div className="message">
            <Markdown>{msg.answer}</Markdown>
          </div>
          {msg.imgFilePath && (
            <div>
              <IKImage
                urlEndpoint={import.meta.env.VITE_IMAGE_KIT_ENDPOINT}
                path={msg.imgFilePath}
                width="380"
                transformation={[{ width: 380 }]}
              />
            </div>
          )}
        </div>
      ))}
      <div className="endChat" ref={endRef}></div>
      <form className="newForm" onSubmit={handleSubmit} ref={formRef}>
        <Upload setImg={setImg} />
        <input id="file" type="file" multiple={false} hidden />
        <input type="text" name="text" placeholder="Ask anything..." />
        <button type="submit">
          <img src="/arrow.png" alt="Send" />
        </button>
      </form>
    </>
  );
};

export default NewPrompt;
