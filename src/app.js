import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"

const app = express()


// middlewares are mostly used with app.use

app.use(cors({
    origin: process.env.CORS_ORIGIN,

}));


//config for datas filled in form
app.use(express.json({limit: "20kb"}))

// datas from url cause some problems as urls maybe be encoded in different ways
//config for url
app.use(express.urlencoded({extended: true, limit: "20kb"}))


// we also need to deal with public assests for example pdf,images which we want to store in our server
app.use(express.static("public"))
app.use(cookieParser())                                                                  




export default app