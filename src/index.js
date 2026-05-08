
// this is dotenv to 
import dotenv from "dotenv"
import connectDB from "./db/index.js"
import app from "./app.js"
dotenv.config({
    path: "./.env"
})


connectDB()
.then( () => {
    // we try to listen for errors before app.listen sometimes here is that

    app.on("error", (error) => {
        console.log("ERROR: ", error)
        throw error
    })

    app.listen(process.env.PORT || 8000), () => {
        console.log(` Server is running at port: ${process.env.PORT}`);
    }
})
.catch((error) => {
    console.log("MONGO db connection failed !!! ", error);
})






















// use try-catch, promises and async always for databases


// using iffe for cleaner code
/*
( async () => {
    try{
        await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
        app.on("error", (error) => {
            console.log("ERROR: ", error);
            throw error
        })


        app.listen(process.env.PORT, ()=> {
            console.log(`App is listening on port $
                {process.env.PORT}`)
        })

    } catch(error){
        console.log("ERROR: ", error)
        throw error
    }
}
)()*/