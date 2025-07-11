// alumni.model.js
import mongoose, { Schema } from "mongoose";

const alumniSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    designation: {
      type: String,
      required: true,
      trim: true,
    },
    batch: {
      type: String,
      required: true,
      trim: true,
      match: [/^\d{4}-\d{4}$/, 'Batch must be in format YYYY-YYYY (e.g., 2015-2018)']
    },
    linkedinUrl: {
      type: String,
      required: true,
      trim: true,
    },
    companyLogo: {
      type: String,
      trim: true,
      match: [/^https?:\/\/.+$/, 'Please provide a valid URL for company logo']
    },
    profileImage: {
      type: String,
      trim: true,
      match: [/^https?:\/\/.+$/, 'Please provide a valid URL for profile image']
    },
    location: {
      type: {
        latitude: {
          type: Number,
          required: true,
          min: -90,
          max: 90
        },
        longitude: {
          type: Number,
          required: true,
          min: -180,
          max: 180
        }
      },
      required: true
    }
  },
  { 
    timestamps: true // Adds createdAt and updatedAt fields
  }
);

export const Alumni = mongoose.model("Alumni", alumniSchema);