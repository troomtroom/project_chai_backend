const asyncHandler = (requestHandler) => {
    (req, res, next) => {
        Promise.resolve(requestHandler(req, res, next)).
        catch((error) => next(error))
    }

}


export {asyncHandler}


/*

const asyncHandler = () => {}
const asyncHandler = (func) => () => {}  (func parameter is further passed into an other functuin)
const asyncHandler = (func) => async () =? {}

*/
// using try and catch
/* const asyncHandler = (fn) => async (req, res, next) => {
    try{

        await fn(req, res, next)

    } catch(error){
        res.status(error.code || 500).json({
            success: true,
            message: error.message
        })
    }
}*/