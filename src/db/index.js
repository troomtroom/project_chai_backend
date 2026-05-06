import mongoose from "mongoose"
import { DB_NAME } from "../constants.js"

const connectDB = async () => {
    try {
        const connectionInstance =  await mongoose.connect
        (`${process.env.MONGODB_URI}/${DB_NAME}`);
        console.log(`\n MONGODB connected !! DB_HOST: ${connectionInstance.connection.host}`)
    } catch (error) {
        console.log("MONGODB connection FAILED ", error)
        process.exit(1)
        // process is the reference to process that current applicatiom is being run on  that is being run 
    }
}

export default connectDB