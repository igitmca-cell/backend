import mongoose from "mongoose";
import { Schema } from "mongoose";

const semesterResourceSchema = new Schema(
  {
    semester: {
      type: Number,
      required: true,
      enum: [1, 2, 3, 4],
      index: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: ["notes", "questionPaper"],
    },
    fileUrl: {
      type: String,
      required: true,
    },
    batch: {
      type: String,
      trim: true,required: [
        function () {
          return this.type === "questionPaper";
        },
        "Batch is required for question papers",
      ],
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    academicYear: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

semesterResourceSchema.index({ semester: 1, type: 1, batch: 1 });

semesterResourceSchema.pre("save", function (next) {
  if (this.type === "questionPaper" && !this.batch) {
    return next(new Error("Batch is required for question papers"));
  }
  if (this.type === "notes") {
    this.batch = undefined;
    this.academicYear = undefined;
  }
  next();
});


export const SemesterResource = mongoose.model("SemesterResource", semesterResourceSchema);