import express from "express";
import cors from "cors";
import path from "path";
import url, { fileURLToPath } from "url";
import ImageKit from "imagekit";
import mongoose from "mongoose";
import dotenv from "dotenv";
import Chat from "./models/chat.js";
import UserChats from "./models/userChats.js";
import { ClerkExpressRequireAuth } from "@clerk/clerk-sdk-node";

// Load environment variables from .env file
dotenv.config();

const port = process.env.PORT || 3000;
const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);

app.use(express.json());

// MongoDB connection setup
const connect = async () => {
  try {
    if (!process.env.MONGO) {
      throw new Error("MongoDB connection string is missing.");
    }
    await mongoose.connect(process.env.MONGO);
    console.log("Connected to MongoDB");
  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1); // Exit process with failure code
  }
};

// Initialize ImageKit
const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

// Routes
app.get("/api/upload", (req, res) => {
  try {
    const result = imagekit.getAuthenticationParameters();
    res.send(result);
  } catch (err) {
    console.error("Error in /api/upload route:", err);
    res.status(500).send("Error getting authentication parameters.");
  }
});

app.post("/api/chats", ClerkExpressRequireAuth(), async (req, res) => {
  const userId = req.auth.userId;
  const { text } = req.body;

  try {
    const newChat = new Chat({
      userId: userId,
      history: [{ role: "user", parts: [{ text }] }],
    });

    const savedChat = await newChat.save();

    const userChats = await UserChats.findOne({ userId });

    if (!userChats) {
      const newUserChats = new UserChats({
        userId: userId,
        chats: [
          {
            _id: savedChat._id,
            title: text.substring(0, 40),
          },
        ],
      });
      await newUserChats.save();
    } else {
      await UserChats.updateOne(
        { userId: userId },
        {
          $push: {
            chats: {
              _id: savedChat._id,
              title: text.substring(0, 40),
            },
          },
        }
      );
    }

    res.status(201).send(newChat._id);
  } catch (err) {
    console.error("Error in /api/chats route:", err);
    res.status(500).send("Error creating chat!");
  }
});

app.get("/api/userchats", ClerkExpressRequireAuth(), async (req, res) => {
  const userId = req.auth.userId;

  try {
    const userChats = await UserChats.findOne({ userId });
    res.status(200).send(userChats ? userChats.chats : []);
  } catch (err) {
    console.error("Error in /api/userchats route:", err);
    res.status(500).send("Error fetching user chats!");
  }
});

app.get("/api/chats/:id", ClerkExpressRequireAuth(), async (req, res) => {
  const userId = req.auth.userId;

  try {
    const chat = await Chat.findOne({ _id: req.params.id, userId });
    if (chat) {
      res.status(200).send(chat);
    } else {
      res.status(404).send("Chat not found!");
    }
  } catch (err) {
    console.error("Error in /api/chats/:id route:", err);
    res.status(500).send("Error fetching chat!");
  }
});

app.put("/api/chats/:id", ClerkExpressRequireAuth(), async (req, res) => {
  const userId = req.auth.userId;
  const { question, answer, img } = req.body;

  const newItems = [
    ...(question
      ? [{ role: "user", parts: [{ text: question }], ...(img && { img }) }]
      : []),
    { role: "model", parts: [{ text: answer }] },
  ];

  try {
    const updatedChat = await Chat.updateOne(
      { _id: req.params.id, userId },
      {
        $push: {
          history: {
            $each: newItems,
          },
        },
      }
    );
    if (updatedChat.modifiedCount > 0) {
      res.status(200).send("Chat updated successfully.");
    } else {
      res.status(404).send("Chat not found!");
    }
  } catch (err) {
    console.error("Error in /api/chats/:id route:", err);
    res.status(500).send("Error updating chat!");
  }
});

// Error handling
app.use((err, req, res, next) => {
  console.error("Global error handler:", err.stack);
  res.status(500).send("Internal Server Error");
});

// Serve static files in production
app.use(express.static(path.join(__dirname, "../client/dist")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../client/dist", "index.html"));
});

app.listen(port, () => {
  connect();
  console.log(`Server running on port ${port}`);
});
