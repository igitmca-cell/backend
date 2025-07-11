import mongoose, { Schema } from "mongoose";

const noticeSchema = new Schema(
  {
    id: {
      type: String,
      required: true, // Make ID required since it’s the unique identifier
      unique: true,   // Ensure no duplicate IDs in the database
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    pdfLink: {
      type: String, // Assuming this is a URL to a PDF file
    },
    isNew: {
      type: Boolean,
      default: false, // Optional field to indicate if the notice is marked as "new"
    },
  },
  { timestamps: true } // Keeps createdAt and updatedAt fields
);

export const Notice = mongoose.model("Notice", noticeSchema);