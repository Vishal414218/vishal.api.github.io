import mongoose from "mongoose";

const userChatsSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
    },
    chats: [
      {
        _id: {
          type: String,
          required: true,
        },
        title: {
          type: String,
          required: true,
        },
        createdAt: {
          type: Date,
          default: Date.now, // Use Date.now as a function
        },
      },
    ],
  },
  { timestamps: true } // Automatically adds createdAt and updatedAt
);

export default mongoose.models.UserChats || mongoose.model("UserChats", userChatsSchema);
