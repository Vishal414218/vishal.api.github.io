import { Link } from "react-router-dom";
import "./chatList.css";
import { useQuery } from "@tanstack/react-query";

const ChatList = () => {
  const { isLoading, isError, data } = useQuery({
    queryKey: ["userChats"],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/userchats`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Network response was not ok");
      return res.json();
    },
    retry: 2, // Retry failed requests up to 2 times
  });

  if (isLoading) return <div>Loading...</div>;
  if (isError) return <div>Something went wrong!</div>;

  return (
    <div className="chatList">
      <span className="title">DASHBOARD</span>
      <Link to="/dashboard">Create a new Chat</Link>
      <Link to="/">Explore Vishal AI</Link>
      <Link to="/">Contact</Link>
      <hr />
      <span className="title">RECENT CHATS</span>
      <div className="list">
        {data && data.length > 0 ? (
          data.map((chat) => (
            <Link to={`/dashboard/chats/${chat._id}`} key={chat._id}>
              {chat.title || "Untitled"}
            </Link>
          ))
        ) : (
          <div>No recent chats</div>
        )}
      </div>
      <hr />
      <div className="upgrade">
        <img src="/user_icon.png" alt="Vishal AI Logo" />
        <div className="texts">
          <span>Upgrade to Vishal AI Pro</span>
          <span>Get unlimited access to all features</span>
        </div>
      </div>
    </div>
  );
};

export default ChatList;
