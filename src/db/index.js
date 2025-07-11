import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";



const connectDB = async () =>{
    try {
       const response= await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
       console.log(`mogodb connected!! DB HOST:${response.connection.host}`)
      
        // console.log(response);
    } catch (error) {
        console.log("data base error:",error);
        process.exit(1);
    }
}
export default connectDB