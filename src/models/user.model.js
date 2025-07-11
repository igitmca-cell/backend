import mongoose, { Schema } from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

const userSchema = new Schema(
    {
        fullname: {
            type: String,
            required: true,
            trim: true,
            index: true
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },
        linkedinUrl: {
            type: String
        },
        githubUrl: {
            type: String
        },
        status: {
            type: String,
            enum: ["pending", "active", "inactive"],
            default: "pending"
        },
        role: {
            type: String,
            enum: ["student", "cr", "cdc","teacher","mycomp"],
            default: "student"
        },
        rollno: {
            type: String
        },
        profileImage: {
            type: String, // Cloudinary URL
            required: true
        },
        batch: {
            type: String,
            required: true, // Adjust based on your needs
            trim: true,
            default: "43"
        },
        password: {
            type: String,
            required: [true, "Password is required"]
        },
        refreshToken: {
            type: String
        },
        expoPushToken: {
            type: String, // Expo push token for notifications
            trim: true
        },
        biometricPublicKey:{
            type:String,
        }
    },
    { timestamps: true }
);

userSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

userSchema.methods.isPasswordCorrect = async function(password) {
    return await bcrypt.compare(password, this.password);
};

userSchema.methods.generateAccessToken = function() {
    return jwt.sign(
        {
            _id: this._id,
            email: this.email,
            fullname: this.fullname,
            role: this.role
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: process.env.ACCES_TOKEN_EXPIRY // Typo corrected to ACCESS_TOKEN_EXPIRY if needed
        }
    );
};

userSchema.methods.generateRefreshToken = function() {
    return jwt.sign(
        {
            _id: this._id
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY
        }
    );
};

export const User = mongoose.model("User", userSchema);